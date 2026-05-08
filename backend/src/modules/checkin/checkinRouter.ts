import { Router } from "express";
import { getPool } from "../../db/pool.js";
import { extractAndVerifyJwt, requireRole } from "../../middleware/auth.js";
import { publishJson } from "../../rabbitmq/client.js";
import { NotificationEventType, QUEUE_NOTIFICATION } from "../notifications/eventTypes.js";
import { v4 as uuidv4 } from "uuid";

export function checkinRouter() {
  const router = Router();

  // 9.1 Preload confirmed QR records for a workshop
  router.get(
    "/preload",
    extractAndVerifyJwt,
    requireRole("staff"),
    async (req, res) => {
      const workshopId = req.query.workshop_id;
      if (!workshopId || typeof workshopId !== "string") {
        return res.status(400).json({ code: "INVALID_REQUEST", message: "workshop_id is required" });
      }

      const pool = getPool();
      try {
        const result = await pool.query(`
          SELECT 
            r.qr_code, 
            u.full_name as "studentName", 
            u.student_id as "studentId"
          FROM registrations r
          JOIN users u ON u.id = r.user_id
          WHERE r.workshop_id = $1 AND r.status = 'confirmed'
        `, [workshopId]);

        return res.json({
          workshopId,
          preloadedAt: new Date().toISOString(),
          records: result.rows
        });
      } catch (err) {
        console.error("Error preloading check-in data:", err);
        return res.status(500).json({ code: "INTERNAL_ERROR" });
      }
    }
  );

  // 9.2 Online check-in scan
  router.post(
    "/",
    extractAndVerifyJwt,
    requireRole("staff"),
    async (req, res) => {
      const { qr_code, workshop_id, device_id } = req.body;

      if (!qr_code || !workshop_id) {
        return res.status(400).json({ code: "INVALID_REQUEST", message: "qr_code and workshop_id are required" });
      }

      const pool = getPool();
      try {
        // 1. Fetch registration and workshop details
        const regRes = await pool.query(`
          SELECT 
            r.id, r.status, r.user_id,
            u.full_name as "studentName",
            w.title as "workshopTitle",
            w.end_time as "endTime"
          FROM registrations r
          JOIN users u ON u.id = r.user_id
          JOIN workshops w ON w.id = r.workshop_id
          WHERE r.qr_code = $1 AND r.workshop_id = $2
        `, [qr_code, workshop_id]);

        if (regRes.rowCount === 0) {
          return res.status(404).json({ code: "QR_NOT_FOUND" });
        }

        const registration = regRes.rows[0];

        // 2. Business checks
        if (registration.status !== "confirmed" && registration.status !== "attended") {
          return res.status(400).json({ 
            code: "REGISTRATION_NOT_CONFIRMED", 
            currentStatus: registration.status 
          });
        }

        const endTime = new Date(registration.endTime);
        const twoHoursAfterEnd = new Date(endTime.getTime() + 2 * 60 * 60 * 1000);
        if (new Date() > twoHoursAfterEnd) {
          return res.status(400).json({ code: "WORKSHOP_ENDED" });
        }

        // 3. Check for existing check-in (idempotency)
        const checkinRes = await pool.query(
          "SELECT id, checkin_time FROM checkins WHERE registration_id = $1",
          [registration.id]
        );

        if (checkinRes.rowCount! > 0) {
          return res.status(409).json({ 
            code: "ALREADY_CHECKED_IN", 
            checkedInAt: checkinRes.rows[0].checkin_time 
          });
        }

        // 4. Atomic check-in
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          await client.query(`
            INSERT INTO checkins (registration_id, user_id, workshop_id, checkin_time, device_id)
            VALUES ($1, $2, $3, NOW(), $4)
          `, [registration.id, registration.user_id, workshop_id, device_id || null]);

          await client.query(`
            UPDATE registrations SET status = 'attended', updated_at = NOW()
            WHERE id = $1
          `, [registration.id]);

          await client.query("COMMIT");

          // 5. Publish notification (Push only per spec)
          publishJson(QUEUE_NOTIFICATION, {
            eventId: uuidv4(),
            eventType: NotificationEventType.CHECKIN_CONFIRMED,
            userId: registration.user_id,
            workshopId: workshop_id,
            registrationId: registration.id,
            payload: {
              workshopTitle: registration.workshopTitle,
            },
            publishedAt: new Date().toISOString()
          }).catch(err => console.error("Failed to publish check-in notification:", err));

          return res.json({
            status: "success",
            studentName: registration.studentName,
            workshopTitle: registration.workshopTitle,
            checkedInAt: new Date().toISOString()
          });
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        console.error("Error during online check-in:", err);
        return res.status(500).json({ code: "INTERNAL_ERROR" });
      }
    }
  );

  // 9.3 Batch offline sync
  router.post(
    "/sync-offline",
    extractAndVerifyJwt,
    requireRole("staff"),
    async (req, res) => {
      const { records } = req.body;

      if (!records || !Array.isArray(records)) {
        return res.status(400).json({ code: "INVALID_REQUEST", message: "records array is required" });
      }

      if (records.length > 50) {
        return res.status(400).json({ code: "INVALID_REQUEST", message: "Maximum 50 records per sync" });
      }

      const pool = getPool();
      let successCount = 0;
      let skippedCount = 0;
      const conflicts: any[] = [];

      for (const record of records) {
        const { localId, qr_code, workshop_id, checked_in_at, device_id } = record;

        try {
          // 1. Fetch registration
          const regRes = await pool.query(`
            SELECT r.id, r.status, r.user_id
            FROM registrations r
            WHERE r.qr_code = $1 AND r.workshop_id = $2
          `, [qr_code, workshop_id]);

          if (regRes.rowCount === 0) {
            conflicts.push({ localId, reason: "INVALID_QR" });
            continue;
          }

          const registration = regRes.rows[0];

          // 2. Insert check-in with idempotency
          const client = await pool.connect();
          try {
            await client.query("BEGIN");

            const insertRes = await client.query(`
              INSERT INTO checkins (registration_id, user_id, workshop_id, checkin_time, device_id)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (registration_id) DO NOTHING
              RETURNING id
            `, [registration.id, registration.user_id, workshop_id, checked_in_at, device_id || null]);

            if (insertRes.rowCount === 0) {
              // Already exists in DB (could be from previous sync or online scan)
              conflicts.push({ localId, reason: "ALREADY_CHECKED_IN_ONLINE" });
              await client.query("ROLLBACK");
              continue;
            }

            // 3. Update registration status if not already attended
            await client.query(`
              UPDATE registrations SET status = 'attended', updated_at = NOW()
              WHERE id = $1 AND status != 'attended'
            `, [registration.id]);

            await client.query("COMMIT");
            successCount++;
          } catch (err) {
            await client.query("ROLLBACK");
            throw err;
          } finally {
            client.release();
          }
        } catch (err) {
          console.error(`Error syncing record ${localId}:`, err);
          skippedCount++;
        }
      }

      return res.json({
        processed: records.length,
        success: successCount,
        skipped: skippedCount,
        conflicts: conflicts
      });
    }
  );

  return router;
}
