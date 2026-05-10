import { Router, Request, Response } from "express";
import { z } from "zod";
import { getPool } from "../../db/pool.js";
import { extractAndVerifyJwt, checkJwtBlacklistFailOpen, loadUser, requireRole } from "../../middleware/auth.js";
import { publishJson } from "../../rabbitmq/client.js";
import { QUEUE_NOTIFICATION, EventType } from "../notifications/eventTypes.js";
import { randomUUID } from "crypto";

export function checkinRouter() {
  const router = Router();

  router.use(extractAndVerifyJwt);
  router.use(checkJwtBlacklistFailOpen);
  router.use(loadUser);
  router.use(requireRole("staff"));

  router.get("/preload", async (req: Request, res: Response) => {
    const workshopId = req.query.workshop_id as string;
    if (!workshopId) {
      return res.status(400).json({ code: "BAD_REQUEST", message: "workshop_id is required" });
    }

    const pool = getPool();
    const result = await pool.query(
      `SELECT r.qr_code, u.full_name as "studentName", u.student_id as "studentId"
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       WHERE r.workshop_id = $1 AND r.status = 'confirmed'`,
      [workshopId]
    );

    res.json({
      workshopId,
      preloadedAt: new Date().toISOString(),
      records: result.rows
    });
  });

  router.post("/", async (req: Request, res: Response) => {
    const schema = z.object({
      qr_code: z.string().uuid(),
      workshop_id: z.string().uuid(),
      device_id: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "BAD_REQUEST", details: parsed.error.issues });
    }

    const { qr_code, workshop_id, device_id } = parsed.data;
    const pool = getPool();

    const regRes = await pool.query(
      `SELECT r.id, r.status, r.user_id, u.full_name, w.title, w.end_time
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       JOIN workshops w ON w.id = r.workshop_id
       WHERE r.qr_code = $1 AND r.workshop_id = $2`,
      [qr_code, workshop_id]
    );

    if (regRes.rows.length === 0) {
      return res.status(404).json({ code: "QR_NOT_FOUND" });
    }

    const reg = regRes.rows[0];

    if (reg.status !== "confirmed") {
      return res.status(400).json({ code: "REGISTRATION_NOT_CONFIRMED", currentStatus: reg.status });
    }

    const endTime = new Date(reg.end_time);
    const deadline = new Date(endTime.getTime() + 2 * 60 * 60 * 1000);
    if (new Date() > deadline) {
      return res.status(400).json({ code: "WORKSHOP_ENDED" });
    }

    const checkinRes = await pool.query(
      `SELECT id, checkin_time FROM checkins WHERE registration_id = $1`,
      [reg.id]
    );

    if (checkinRes.rows.length > 0) {
      return res.status(409).json({ code: "ALREADY_CHECKED_IN", checkedInAt: checkinRes.rows[0].checkin_time });
    }

    const client = await pool.connect();
    let checkedInAt = new Date();
    try {
      await client.query("BEGIN");
      
      await client.query(
        `INSERT INTO checkins (registration_id, user_id, workshop_id, checkin_time, device_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [reg.id, reg.user_id, workshop_id, checkedInAt, device_id]
      );

      await client.query(
        `UPDATE registrations SET status = 'attended', updated_at = NOW() WHERE id = $1`,
        [reg.id]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      // Unique constraint violation handle if race condition
      if ((err as any).code === '23505') {
        const checkinRes2 = await pool.query(
          `SELECT checkin_time FROM checkins WHERE registration_id = $1`,
          [reg.id]
        );
        if (checkinRes2.rows.length > 0) {
          return res.status(409).json({ code: "ALREADY_CHECKED_IN", checkedInAt: checkinRes2.rows[0].checkin_time });
        }
      }
      throw err;
    } finally {
      client.release();
    }

    // Publish event
    try {
      await publishJson(QUEUE_NOTIFICATION, {
        eventId: randomUUID(),
        eventType: "CHECKIN_CONFIRMED" as EventType,
        userId: reg.user_id,
        workshopId: workshop_id,
        registrationId: reg.id,
        payload: { title: reg.title },
        publishedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to publish CHECKIN_CONFIRMED event:", err);
    }

    res.status(200).json({
      status: "success",
      studentName: reg.full_name,
      workshopTitle: reg.title,
      checkedInAt: checkedInAt.toISOString()
    });
  });

  router.post("/sync-offline", async (req: Request, res: Response) => {
    const recordSchema = z.object({
      localId: z.string(),
      qr_code: z.string().uuid(),
      workshop_id: z.string().uuid(),
      checked_in_at: z.string(),
      device_id: z.string().optional()
    });

    const schema = z.object({
      records: z.array(recordSchema).max(50)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "BAD_REQUEST", details: parsed.error.issues });
    }

    const { records } = parsed.data;
    const pool = getPool();
    
    let success = 0;
    let skipped = 0;
    const conflicts: { localId: string; reason: string }[] = [];

    for (const record of records) {
      const regRes = await pool.query(
        `SELECT r.id, r.status, r.user_id, w.title
         FROM registrations r
         JOIN workshops w ON w.id = r.workshop_id
         WHERE r.qr_code = $1 AND r.workshop_id = $2`,
        [record.qr_code, record.workshop_id]
      );

      if (regRes.rows.length === 0) {
        conflicts.push({ localId: record.localId, reason: "INVALID_QR" });
        continue;
      }

      const reg = regRes.rows[0];

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        const insertRes = await client.query(
          `INSERT INTO checkins (registration_id, user_id, workshop_id, checkin_time, device_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (registration_id) DO NOTHING
           RETURNING id`,
          [reg.id, reg.user_id, record.workshop_id, record.checked_in_at, record.device_id]
        );

        if (insertRes.rows.length === 0) {
          conflicts.push({ localId: record.localId, reason: "ALREADY_CHECKED_IN" }); // Wait, spec says ALREADY_CHECKED_IN_ONLINE
          // Actually, let's just use ALREADY_CHECKED_IN or ALREADY_CHECKED_IN_ONLINE. Spec AC-08 says "ALREADY_CHECKED_IN_ONLINE"
          await client.query("ROLLBACK");
          continue;
        }

        await client.query(
          `UPDATE registrations SET status = 'attended', updated_at = NOW() WHERE id = $1`,
          [reg.id]
        );

        await client.query("COMMIT");
        success++;
        
        // Publish event best-effort
        try {
          await publishJson(QUEUE_NOTIFICATION, {
            eventId: randomUUID(),
            eventType: "CHECKIN_CONFIRMED" as EventType,
            userId: reg.user_id,
            workshopId: record.workshop_id,
            registrationId: reg.id,
            payload: { title: reg.title },
            publishedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Failed to publish CHECKIN_CONFIRMED event:", err);
        }
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Sync error for record:", record.localId, err);
        skipped++;
      } finally {
        client.release();
      }
    }

    // Need to change the conflict reason back to ALREADY_CHECKED_IN_ONLINE if that's what spec wants. 
    // Spec output example: "ALREADY_CHECKED_IN_ONLINE"
    for(const c of conflicts) {
      if (c.reason === "ALREADY_CHECKED_IN") c.reason = "ALREADY_CHECKED_IN_ONLINE";
    }

    res.json({
      processed: records.length,
      success,
      skipped,
      conflicts
    });
  });

  return router;
}
