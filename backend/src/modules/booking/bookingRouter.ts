import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import { getPool } from "../../db/pool.js";
import { getRedis } from "../../redis/client.js";
import { publishJson } from "../../rabbitmq/client.js";
import { QUEUE_NOTIFICATION } from "../notifications/eventTypes.js";
import { invalidateWorkshopCaches } from "../workshops/workshopCache.js";
import { tokenBucketConsume } from "../../redis/rateLimit.js";
import {
  checkJwtBlacklistFailOpen,
  extractAndVerifyJwt,
  loadUser,
  requireRole,
  type AuthedRequest
} from "../../middleware/auth.js";
import { chargePaidRegistration } from "../payment/paymentService.js";

async function registerRateLimitGate(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const userId = req.user!.id;
  const ip = req.ip ?? "unknown";

  const u = await tokenBucketConsume({
    key: `ratelimit:user:${userId}:register`,
    maxTokens: 5,
    refillPerSecond: 5 / 60
  });
  if (!u.allowed) return res.status(429).setHeader("Retry-After", String(u.retryAfterSeconds)).json({ code: "RATE_LIMITED" });

  const ipRl = await tokenBucketConsume({
    key: `ratelimit:ip:${ip}:register`,
    maxTokens: 120,
    refillPerSecond: 120 / 60
  });
  if (!ipRl.allowed) return res.status(429).setHeader("Retry-After", String(ipRl.retryAfterSeconds)).json({ code: "RATE_LIMITED" });

  const g = await tokenBucketConsume({
    key: `ratelimit:global:register`,
    maxTokens: 60_000,
    refillPerSecond: 60_000 / 60
  });
  if (!g.allowed) return res.status(429).setHeader("Retry-After", String(g.retryAfterSeconds)).json({ code: "RATE_LIMITED" });

  next();
}

export function bookingRouter() {
  const router = express.Router();

  router.use(extractAndVerifyJwt, checkJwtBlacklistFailOpen, loadUser);

  router.get("/my-registrations", requireRole("student"), async (req: AuthedRequest, res) => {
    const pool = getPool();
    const r = await pool.query(
      `
      select r.id, r.status, r.qr_code, r.created_at,
             w.id as workshop_id, w.title, w.start_time, w.room, w.is_paid, w.price
      from registrations r
      join workshops w on w.id = r.workshop_id
      where r.user_id = $1
      order by r.created_at desc
      `,
      [req.user!.id]
    );
    return res.json({ registrations: r.rows });
  });

  router.post("/registrations/:id/cancel", requireRole("student", "admin"), async (req: AuthedRequest, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const reg = await client.query(
        `
        select r.*, w.start_time, w.is_paid, w.title as workshop_title, w.id as workshop_id
        from registrations r
        join workshops w on w.id = r.workshop_id
        where r.id = $1
        for update
        `,
        [id.data]
      );
      const row = reg.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return res.status(404).json({ code: "NOT_FOUND" });
      }

      if (req.user!.role === "student" && row.user_id !== req.user!.id) {
        await client.query("ROLLBACK");
        return res.status(404).json({ code: "NOT_FOUND" });
      }

      if (row.status !== "confirmed") {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Không thể hủy đăng ký ở trạng thái này" });
      }

      if (row.is_paid) {
        const paid = await client.query(
          `select 1 from payments where registration_id = $1 and status = 'success' limit 1`,
          [id.data]
        );
        if (paid.rows.length && req.user!.role === "student") {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: "Đăng ký có phí đã thanh toán — liên hệ ban tổ chức để hủy" });
        }
      }

      const st = new Date(row.start_time).getTime();
      if (st <= Date.now() + 60 * 60 * 1000) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Không thể hủy trong vòng 1 giờ trước workshop" });
      }

      await client.query(
        `update registrations set status = 'cancelled', qr_code = null, updated_at = now() where id = $1`,
        [id.data]
      );
      await client.query(
        `update workshops set confirmed_count = greatest(confirmed_count - 1, 0), updated_at = now() where id = $1`,
        [row.workshop_id]
      );
      await client.query("COMMIT");

      try {
        await publishJson(QUEUE_NOTIFICATION, {
          eventId: randomUUID(),
          eventType: "REGISTRATION_CANCELLED",
          userId: row.user_id,
          workshopId: row.workshop_id,
          registrationId: id.data,
          payload: { workshopTitle: row.workshop_title ?? "" },
          publishedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("cancel notify failed", e);
      }
      try {
        await invalidateWorkshopCaches(row.workshop_id);
      } catch (e) {
        console.warn("cache invalidate", e);
      }

      return res.json({ cancelled: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });

  router.post("/register", requireRole("student"), registerRateLimitGate, async (req: AuthedRequest, res) => {
    const body = z.object({ workshop_id: z.string().uuid() }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const idemHeader =
      (typeof req.headers["idempotency-key"] === "string" && req.headers["idempotency-key"]) ||
      (typeof req.headers["Idempotency-Key"] === "string" && req.headers["Idempotency-Key"]) ||
      "";

    const workshopId = body.data.workshop_id;
    const userId = req.user!.id;

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '3000ms'");

      const wres = await client.query(
        `
        select w.*,
               (select count(*)::int from registrations r
                where r.workshop_id = w.id and r.status in ('pending','confirmed')) as held,
               now() as db_now
        from workshops w
        where w.id = $1
        for update
        `,
        [workshopId]
      );

      const w = wres.rows[0];
      if (!w) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Workshop không tồn tại" });
      }

      const dbNow = new Date(w.db_now);
      const openAt = new Date(w.registration_open_at);
      const closeAt = new Date(w.registration_close_at);

      if (w.status !== "active") {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Workshop không còn nhận đăng ký" });
      }
      if (dbNow < openAt) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Chưa đến giờ mở đăng ký" });
      }
      if (dbNow > closeAt) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Đã hết hạn đăng ký" });
      }

      const capacity = Number(w.capacity);
      const held = Number(w.held);
      if (held >= capacity) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Workshop đã hết chỗ" });
      }

      const userActive = await client.query(`select is_active from users where id = $1`, [userId]);
      if (!userActive.rows[0]?.is_active) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Tài khoản không còn hợp lệ" });
      }

      const dup = await client.query(
        `select id, status, qr_code from registrations where user_id = $1 and workshop_id = $2`,
        [userId, workshopId]
      );
      if (dup.rows.length) {
        const ex = dup.rows[0]!;
        if (ex.status === "confirmed" && ex.qr_code) {
          await client.query("ROLLBACK");
          return res.json({ qr_code: ex.qr_code, already_registered: true });
        }
        if (ex.status === "pending") {
          await client.query("COMMIT");
          if (!w.is_paid) {
            return res.status(202).json({ message: "Đang xử lý" });
          }
          if (!idemHeader) {
            return res.status(400).json({ code: "MISSING_IDEMPOTENCY_KEY" });
          }
          const pay = await chargePaidRegistration({
            userId,
            workshopId,
            registrationId: ex.id,
            idempotencyClientKey: idemHeader,
            amount: Number(w.price),
            workshopTitle: w.title,
            startTime: new Date(w.start_time),
            room: w.room,
            speaker: w.speaker
          });
          if (pay.status === 200) return res.json({ qr_code: pay.qr_code });
          if (pay.status === 202) return res.status(202).json({ message: "Đang xử lý thanh toán" });
          if (pay.status === 402) return res.status(402).json({ message: "Thanh toán bị từ chối" });
          return res.status(503).json({ message: "Thanh toán tạm thời gián đoạn" });
        }
        if (ex.status === "confirmed") {
          await client.query("ROLLBACK");
          return res.json({ qr_code: ex.qr_code });
        }
      }

      const isPaid = Boolean(w.is_paid);
      if (isPaid && !idemHeader) {
        await client.query("ROLLBACK");
        return res.status(400).json({ code: "MISSING_IDEMPOTENCY_KEY" });
      }

      const qr = isPaid ? null : randomUUID();
      const status = isPaid ? "pending" : "confirmed";

      let registrationId: string;
      try {
        const ins = await client.query(
          `
          insert into registrations (user_id, workshop_id, status, qr_code)
          values ($1, $2, $3, $4)
          returning id
          `,
          [userId, workshopId, status, qr]
        );
        registrationId = ins.rows[0]!.id as string;
      } catch {
        await client.query("ROLLBACK");
        const again = await pool.query(
          `select id, status, qr_code from registrations where user_id = $1 and workshop_id = $2`,
          [userId, workshopId]
        );
        const row = again.rows[0];
        if (row?.status === "confirmed" && row.qr_code) return res.json({ qr_code: row.qr_code });
        return res.status(409).json({ message: "Bạn đã đăng ký workshop này" });
      }

      if (!isPaid) {
        await client.query(`update workshops set confirmed_count = confirmed_count + 1, updated_at = now() where id = $1`, [
          workshopId
        ]);
      }

      await client.query("COMMIT");

      if (!isPaid) {
        try {
          await publishJson(QUEUE_NOTIFICATION, {
            eventId: randomUUID(),
            eventType: "REGISTRATION_CONFIRMED_FREE",
            userId,
            workshopId,
            registrationId,
            payload: {
              workshopTitle: w.title,
              workshopDate: new Date(w.start_time).toISOString(),
              workshopRoom: w.room ?? "",
              speakerName: w.speaker ?? "",
              qrCode: qr,
              price: null
            },
            publishedAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("notify failed", e);
        }
        try {
          await invalidateWorkshopCaches(workshopId);
        } catch (e) {
          console.warn("cache invalidate", e);
        }
        return res.json({ qr_code: qr });
      }

      const pay = await chargePaidRegistration({
        userId,
        workshopId,
        registrationId,
        idempotencyClientKey: idemHeader,
        amount: Number(w.price),
        workshopTitle: w.title,
        startTime: new Date(w.start_time),
        room: w.room,
        speaker: w.speaker
      });

      if (pay.status === 200) return res.json({ qr_code: pay.qr_code });
      if (pay.status === 202) return res.status(202).json({ message: "Đang xử lý thanh toán, vui lòng chờ" });
      if (pay.status === 402) return res.status(402).json({ message: "Thanh toán bị từ chối" });
      return res.status(503).json({ message: "Thanh toán tạm thời gián đoạn" });
    } catch (e: any) {
      await client.query("ROLLBACK");
      if (String(e?.message ?? "").includes("canceling statement due to lock timeout")) {
        return res.status(409).json({ message: "Hệ thống đang bận, vui lòng thử lại" });
      }
      throw e;
    } finally {
      client.release();
    }
  });

  return router;
}
