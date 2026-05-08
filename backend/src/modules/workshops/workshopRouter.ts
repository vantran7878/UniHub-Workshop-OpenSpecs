import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import { getPool } from "../../db/pool.js";
import { getRedis } from "../../redis/client.js";
import {
  checkJwtBlacklistFailOpen,
  extractAndVerifyJwt,
  loadUser,
  requireRole,
  type AuthedRequest
} from "../../middleware/auth.js";
import { publishJson } from "../../rabbitmq/client.js";
import { invalidateWorkshopCaches } from "./workshopCache.js";
import { assertRegistrationWindow, createWorkshopBodySchema, updateWorkshopBodySchema } from "./workshopValidators.js";
import { summaryRouter } from "./summaryRouter.js";

function cacheKey(prefix: string, obj: unknown) {
  const h = crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 24);
  return `${prefix}:${h}`;
}

function clientMeta(req: AuthedRequest) {
  const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
  const userAgent = req.get("user-agent") ?? undefined;
  return { ip_address: ip ?? null, user_agent: userAgent ?? null };
}

async function countConfirmed(pool: ReturnType<typeof getPool>, workshopId: string) {
  const r = await pool.query<{ n: string }>(
    "select count(*)::text as n from registrations where workshop_id = $1 and status = 'confirmed'",
    [workshopId]
  );
  return Number(r.rows[0]?.n ?? 0);
}

function mapWorkshopRow(w: Record<string, unknown>) {
  const capacity = Number(w.capacity);
  const confirmed = Number(w.confirmed_count);
  return {
    ...w,
    capacity,
    confirmed_count: confirmed,
    price: w.price != null ? Number(w.price) : w.price,
    seats_available: Math.max(0, capacity - confirmed)
  };
}

export function workshopRouter() {
  const router = express.Router();

  router.use(extractAndVerifyJwt, checkJwtBlacklistFailOpen, loadUser);

  router.get("/", async (req, res) => {
    const query = z
      .object({
        status: z.enum(["active", "cancelled", "completed"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20)
      })
      .safeParse(req.query);
    if (!query.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const redis = getRedis();
    const key = cacheKey("workshop:list", query.data);
    const cached = await redis.get(key);
    if (cached) return res.json(JSON.parse(cached));

    const pool = getPool();
    const offset = (query.data.page - 1) * query.data.limit;
    const params: unknown[] = [];
    const where: string[] = [];
    if (query.data.status) {
      params.push(query.data.status);
      where.push(`w.status = $${params.length}`);
    }
    const whereSql = where.length ? `where ${where.join(" and ")}` : "";

    const result = await pool.query(
      `
      select
        w.id, w.title, w.speaker, w.room,
        w.start_time, w.end_time, w.is_paid, w.price,
        w.capacity, w.confirmed_count, w.status,
        w.registration_open_at, w.registration_close_at
      from workshops w
      ${whereSql}
      order by w.start_time asc
      limit ${query.data.limit} offset ${offset}
      `,
      params
    );

    const items = result.rows.map((w) => mapWorkshopRow(w as Record<string, unknown>));
    const body = { items, page: query.data.page, limit: query.data.limit };
    await redis.set(key, JSON.stringify(body), "EX", 30);
    return res.json(body);
  });

  router.get("/statistics", requireRole("admin"), async (_req, res) => {
    const redis = getRedis();
    const cacheKeyStats = "workshop:statistics";
    const cached = await redis.get(cacheKeyStats);
    if (cached) return res.json(JSON.parse(cached));

    const pool = getPool();
    const ws = await pool.query(`
      select status, count(*)::int as c from workshops group by status
    `);
    const regs = await pool.query<{ n: string }>(
      "select count(*)::text as n from registrations where status = 'confirmed'"
    );
    const revenue = await pool.query<{ n: string }>(
      "select coalesce(sum(amount), 0)::text as n from payments where status = 'success'"
    );

    const byStatus: Record<string, number> = {};
    for (const row of ws.rows) {
      byStatus[row.status as string] = row.c as number;
    }

    const body = {
      workshopsByStatus: byStatus,
      totalConfirmedRegistrations: Number(regs.rows[0]?.n ?? 0),
      totalRevenue: Number(revenue.rows[0]?.n ?? 0)
    };

    await redis.set(cacheKeyStats, JSON.stringify(body), "EX", 60);
    return res.json(body);
  });

  router.post("/", requireRole("admin"), async (req: AuthedRequest, res) => {
    const parsed = createWorkshopBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", details: parsed.error.flatten() });

    const pool = getPool();
    const body = parsed.data;
    const actorId = req.user!.id;
    const meta = clientMeta(req);

    const price = body.is_paid ? body.price : 0;

    const insert = await pool.query(
      `
      insert into workshops (
        title, description, speaker, room, capacity, is_paid, price,
        registration_open_at, registration_close_at, start_time, end_time,
        created_by, status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')
      returning *
      `,
      [
        body.title,
        body.description ?? null,
        body.speaker ?? null,
        body.room ?? null,
        body.capacity,
        body.is_paid,
        price,
        body.registration_open_at,
        body.registration_close_at,
        body.start_time,
        body.end_time,
        actorId
      ]
    );

    const row = insert.rows[0];
    await pool.query(
      `
      insert into audit_logs (actor_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
      values ($1, 'CREATE_WORKSHOP', 'workshop', $2, null, $3::jsonb, $4, $5)
      `,
      [actorId, row.id, JSON.stringify(row), meta.ip_address, meta.user_agent]
    );

    await invalidateWorkshopCaches();
    return res.status(201).json(mapWorkshopRow(row as Record<string, unknown>));
  });

  router.put("/:id", requireRole("admin"), async (req: AuthedRequest, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const parsed = updateWorkshopBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT", details: parsed.error.flatten() });

    const pool = getPool();
    const actorId = req.user!.id;
    const meta = clientMeta(req);
    const patch = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '3000ms'");
      const cur = await client.query(`select * from workshops where id = $1 for update`, [id.data]);
      const existing = cur.rows[0];
      if (!existing) {
        await client.query("ROLLBACK");
        return res.status(404).json({ code: "WORKSHOP_NOT_FOUND" });
      }
      if (existing.status === "cancelled") {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Workshop đã hủy, không thể sửa" });
      }

      const cr0 = await client.query<{ n: string }>(
        `select count(*)::text as n from registrations where workshop_id = $1 and status = 'confirmed'`,
        [id.data]
      );
      const confirmed = Number(cr0.rows[0]?.n ?? 0);

      const next = { ...existing, ...patch } as Record<string, unknown>;
      const start = new Date(String(next.start_time ?? existing.start_time));
      const end = new Date(String(next.end_time ?? existing.end_time));
      const ro = new Date(String(next.registration_open_at ?? existing.registration_open_at));
      const rc = new Date(String(next.registration_close_at ?? existing.registration_close_at));

      if (patch.start_time !== undefined || patch.end_time !== undefined) {
        if (confirmed > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({ message: `Không thể sửa giờ khi đã có ${confirmed} người đăng ký thành công` });
        }
        if (end <= start) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Thời gian kết thúc phải sau thời gian bắt đầu" });
        }
      }

      if (
        patch.registration_open_at !== undefined ||
        patch.registration_close_at !== undefined ||
        patch.start_time !== undefined
      ) {
        const wErr = assertRegistrationWindow(ro, rc, start);
        if (wErr) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: wErr });
        }
      }

      if (patch.capacity !== undefined) {
        if (patch.capacity < confirmed) {
          await client.query("ROLLBACK");
          return res
            .status(409)
            .json({ message: `Số chỗ mới (${patch.capacity}) nhỏ hơn số đã đăng ký (${confirmed})` });
        }
      }

      const nextIsPaid = patch.is_paid ?? existing.is_paid;
      if (patch.is_paid !== undefined && patch.is_paid !== existing.is_paid && confirmed > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Không thể thay đổi loại phí khi đã có người đăng ký" });
      }

      let nextPrice = existing.price;
      if (patch.price !== undefined) nextPrice = patch.price;
      if (nextIsPaid && Number(nextPrice) <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Workshop có phí phải có giá > 0" });
      }
      if (!nextIsPaid) nextPrice = 0;

      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      const add = (col: string, val: unknown) => {
        sets.push(`${col} = $${i++}`);
        vals.push(val);
      };

      if (patch.title !== undefined) add("title", patch.title);
      if (patch.description !== undefined) add("description", patch.description);
      if (patch.speaker !== undefined) add("speaker", patch.speaker);
      if (patch.room !== undefined) add("room", patch.room);
      if (patch.capacity !== undefined) add("capacity", patch.capacity);
      if (patch.is_paid !== undefined) add("is_paid", patch.is_paid);
      add("price", nextPrice);
      if (patch.registration_open_at !== undefined) add("registration_open_at", patch.registration_open_at);
      if (patch.registration_close_at !== undefined) add("registration_close_at", patch.registration_close_at);
      if (patch.start_time !== undefined) add("start_time", patch.start_time);
      if (patch.end_time !== undefined) add("end_time", patch.end_time);
      sets.push(`updated_at = now()`);

      vals.push(id.data);
      const sql = `update workshops set ${sets.join(", ")} where id = $${i} returning *`;
      const updated = await client.query(sql, vals);
      const newRow = updated.rows[0];

      await client.query(
        `
        insert into audit_logs (actor_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
        values ($1, 'UPDATE_WORKSHOP', 'workshop', $2, $3::jsonb, $4::jsonb, $5, $6)
        `,
        [actorId, id.data, JSON.stringify(existing), JSON.stringify(newRow), meta.ip_address, meta.user_agent]
      );

      await client.query("COMMIT");

      const notifyFields = ["title", "room", "start_time", "end_time", "registration_open_at", "registration_close_at"];
      const shouldNotify = notifyFields.some((k) => patch[k as keyof typeof patch] !== undefined);
      if (shouldNotify) {
        const users = await pool.query<{ user_id: string }>(
          `select distinct user_id from registrations where workshop_id = $1 and status = 'confirmed'`,
          [id.data]
        );
        for (const u of users.rows) {
          try {
            await publishJson("notification.queue", {
              eventId: randomUUID(),
              eventType: "WORKSHOP_UPDATED",
              userId: u.user_id,
              workshopId: id.data,
              registrationId: null,
              payload: {
                workshopTitle: newRow.title,
                workshopDate: newRow.start_time,
                workshopRoom: newRow.room
              },
              publishedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("publish WORKSHOP_UPDATED failed", e);
          }
        }
      }

      try {
        await invalidateWorkshopCaches(id.data);
      } catch (e) {
        console.warn("cache invalidate failed", e);
      }

      return res.json(mapWorkshopRow(newRow as Record<string, unknown>));
    } catch (e: any) {
      await client.query("ROLLBACK");
      if (String(e?.message ?? "").includes("canceling statement due to lock timeout")) {
        return res.status(409).json({ message: "Dữ liệu đang được cập nhật bởi người khác, vui lòng thử lại" });
      }
      throw e;
    } finally {
      client.release();
    }
  });

  router.delete("/:id", requireRole("admin"), async (req: AuthedRequest, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const pool = getPool();
    const actorId = req.user!.id;
    const meta = clientMeta(req);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '3000ms'");
      const cur = await client.query(`select * from workshops where id = $1 for update`, [id.data]);
      const existing = cur.rows[0];
      if (!existing) {
        await client.query("ROLLBACK");
        return res.status(404).json({ code: "WORKSHOP_NOT_FOUND" });
      }

      const confirmed = await countConfirmed(pool, id.data);

      if (confirmed === 0) {
        await client.query(
          `
          insert into audit_logs (actor_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
          values ($1, 'DELETE_WORKSHOP', 'workshop', $2, $3::jsonb, null, $4, $5)
          `,
          [actorId, id.data, JSON.stringify(existing), meta.ip_address, meta.user_agent]
        );
        await client.query(`delete from workshops where id = $1`, [id.data]);
        await client.query("COMMIT");
        try {
          await invalidateWorkshopCaches(id.data);
        } catch (e) {
          console.warn("cache invalidate failed", e);
        }
        return res.status(204).send();
      }

      await client.query(`update workshops set status = 'cancelled', updated_at = now() where id = $1`, [id.data]);
      const affected = await client.query<{ user_id: string }>(
        `
        update registrations
        set status = 'cancelled', updated_at = now()
        where workshop_id = $1 and status in ('confirmed','pending')
        returning user_id
        `,
        [id.data]
      );

      await client.query(
        `
        insert into audit_logs (actor_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
        values ($1, 'CANCEL_WORKSHOP', 'workshop', $2, $3::jsonb, $4::jsonb, $5, $6)
        `,
        [
          actorId,
          id.data,
          JSON.stringify(existing),
          JSON.stringify({ ...existing, status: "cancelled" }),
          meta.ip_address,
          meta.user_agent
        ]
      );

      await client.query("COMMIT");

      const newRow = { ...existing, status: "cancelled" };
      for (const row of affected.rows) {
        try {
          await publishJson("notification.queue", {
            eventId: randomUUID(),
            eventType: "WORKSHOP_CANCELLED",
            userId: row.user_id,
            workshopId: id.data,
            registrationId: null,
            payload: {
              workshopTitle: existing.title,
              workshopDate: existing.start_time,
              workshopRoom: existing.room
            },
            publishedAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("publish WORKSHOP_CANCELLED failed", e);
        }
      }

      try {
        await invalidateWorkshopCaches(id.data);
      } catch (e) {
        console.warn("cache invalidate failed", e);
      }

      return res.json({
        status: "cancelled",
        affected_registrations: affected.rows.length,
        workshop: mapWorkshopRow(newRow as Record<string, unknown>)
      });
    } catch (e: any) {
      await client.query("ROLLBACK");
      if (String(e?.message ?? "").includes("canceling statement due to lock timeout")) {
        return res.status(409).json({ message: "Dữ liệu đang được cập nhật bởi người khác, vui lòng thử lại" });
      }
      throw e;
    } finally {
      client.release();
    }
  });

  router.get("/:id/participants", requireRole("admin"), async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const pool = getPool();
    const r = await pool.query(
      `
      select r.id as registration_id, r.status, r.qr_code, u.id as user_id, u.full_name, u.email, u.student_id
      from registrations r
      join users u on u.id = r.user_id
      where r.workshop_id = $1 and r.status = 'confirmed'
      order by u.full_name asc
      `,
      [id.data]
    );
    return res.json({ workshopId: id.data, participants: r.rows });
  });

  router.get("/:id", async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const redis = getRedis();
    const key = `workshop:${id.data}:cached`;
    const cached = await redis.get(key);
    if (cached) return res.json(JSON.parse(cached));

    const pool = getPool();
    const r = await pool.query(
      `
      select
        w.id, w.title, w.description, w.speaker, w.room,
        w.start_time, w.end_time, w.is_paid, w.price,
        w.capacity, w.confirmed_count, w.status,
        w.registration_open_at, w.registration_close_at
      from workshops w
      where w.id = $1
      `,
      [id.data]
    );

    const w = r.rows[0];
    if (!w) return res.status(404).json({ code: "WORKSHOP_NOT_FOUND" });

    const body = mapWorkshopRow(w as Record<string, unknown>);
    await redis.set(key, JSON.stringify(body), "EX", 300);
    return res.json(body);
  });

  router.use("/:id", summaryRouter());

  return router;
}
