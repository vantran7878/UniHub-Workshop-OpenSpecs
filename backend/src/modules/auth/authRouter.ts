import { randomBytes } from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPool } from "../../db/pool.js";
import { getRedis } from "../../redis/client.js";
import { tokenBucketConsume } from "../../redis/rateLimit.js";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function refreshTokenString() {
  return randomBytes(32).toString("hex");
}

export function authRouter() {
  const router = express.Router();

  router.post("/login", async (req, res) => {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ code: "INVALID_INPUT" });

    // Rate limit 5 req/min/IP (approx)
    const ip = req.ip ?? "unknown";
    const rl = await tokenBucketConsume({
      key: `ratelimit:ip:${ip}:login`,
      maxTokens: 5,
      refillPerSecond: 5 / 60
    });
    if (!rl.allowed) {
      return res.status(429).setHeader("Retry-After", String(rl.retryAfterSeconds)).json({ code: "RATE_LIMITED" });
    }

    const pool = getPool();
    const { email, password } = parse.data;

    const userRes = await pool.query<{
      id: string;
      password_hash: string | null;
      role: "student" | "admin" | "staff";
      is_active: boolean;
      full_name: string;
      email: string;
    }>(
      "select id, password_hash, role, is_active, full_name, email from users where email = $1",
      [email]
    );

    const user = userRes.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ code: "INVALID_CREDENTIALS" });
    }
    if (!user.is_active) {
      return res.status(401).json({ code: "USER_INACTIVE" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ code: "INVALID_CREDENTIALS" });
    }

    const { token: accessToken } = await signAccessToken({ userId: user.id, role: user.role, email: user.email });
    const refreshToken = refreshTokenString();

    const redis = getRedis();
    await redis.set(`refresh:${refreshToken}`, JSON.stringify({ userId: user.id, role: user.role }), "EX", 7 * 24 * 60 * 60);

    return res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, role: user.role, fullName: user.full_name, email: user.email }
    });
  });

  router.post("/refresh", async (req, res) => {
    const refreshToken = z.string().min(1).safeParse(req.body?.refreshToken);
    if (!refreshToken.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const redis = getRedis();
    const raw = await redis.get(`refresh:${refreshToken.data}`);
    if (!raw) return res.status(401).json({ code: "REFRESH_TOKEN_EXPIRED" });

    const parsed = z.object({ userId: z.string().uuid(), role: z.enum(["student", "admin", "staff"]) }).safeParse(
      JSON.parse(raw)
    );
    if (!parsed.success) return res.status(401).json({ code: "REFRESH_TOKEN_EXPIRED" });

    const pool = getPool();
    const u = await pool.query<{ id: string; role: "student" | "admin" | "staff"; is_active: boolean; email: string }>(
      "select id, role, is_active, email from users where id = $1",
      [parsed.data.userId]
    );
    const user = u.rows[0];
    if (!user) return res.status(401).json({ code: "USER_NOT_FOUND" });
    if (!user.is_active) return res.status(401).json({ code: "USER_INACTIVE" });

    const { token: accessToken } = await signAccessToken({ userId: user.id, role: user.role, email: user.email });
    return res.json({ accessToken });
  });

  router.post("/logout", async (req, res) => {
    const refreshToken = z.string().min(1).safeParse(req.body?.refreshToken);
    if (!refreshToken.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
    if (!token) return res.status(401).json({ code: "MISSING_TOKEN" });

    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return res.status(401).json({ code: "INVALID_TOKEN" });
    }

    const redis = getRedis();
    await redis
      .multi()
      .del(`refresh:${refreshToken.data}`)
      .set(`jwt:blacklist:${payload.jti}`, "1", "EX", Math.max(1, payload.exp - Math.floor(Date.now() / 1000)))
      .exec();

    return res.status(204).send();
  });

  router.put("/profile", async (req, res) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
    if (!token) return res.status(401).json({ code: "MISSING_TOKEN" });

    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return res.status(401).json({ code: "INVALID_TOKEN" });
    }

    const schema = z.object({
      fcmToken: z.string().optional(),
      fullName: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "INVALID_INPUT" });

    const pool = getPool();
    const { fcmToken, fullName } = parsed.data;

    const sets: string[] = [];
    const vals: any[] = [];
    if (fcmToken !== undefined) {
      sets.push("fcm_token = $" + (vals.length + 1));
      vals.push(fcmToken);
    }
    if (fullName !== undefined) {
      sets.push("full_name = $" + (vals.length + 1));
      vals.push(fullName);
    }

    if (sets.length === 0) return res.status(400).json({ code: "INVALID_INPUT" });

    vals.push(payload.userId);
    await pool.query(
      `update users set ${sets.join(", ")}, updated_at = now() where id = $${vals.length}`,
      vals
    );

    return res.json({ ok: true });
  });

  return router;
}
