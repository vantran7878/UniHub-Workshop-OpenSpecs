import type { NextFunction, Request, Response } from "express";
import { getPool } from "../db/pool.js";
import { getRedis } from "../redis/client.js";
import { verifyAccessToken } from "../modules/auth/jwt.js";

export type Role = "student" | "admin" | "staff";

export type AuthedRequest = Request & {
  jwtPayload?: { sub: string; role: Role; email: string; jti: string; exp: number; iat: number };
  user?: { id: string; role: Role; is_active: boolean; email: string; full_name: string; student_id: string | null };
};

export async function extractAndVerifyJwt(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ code: "MISSING_TOKEN" });

  try {
    const payload = await verifyAccessToken(token);
    req.jwtPayload = payload;
    return next();
  } catch (err: any) {
    if (err?.code === "ERR_JWT_EXPIRED") return res.status(401).json({ code: "TOKEN_EXPIRED" });
    return res.status(401).json({ code: "INVALID_TOKEN" });
  }
}

export async function checkJwtBlacklistFailOpen(req: AuthedRequest, _res: Response, next: NextFunction) {
  const jti = req.jwtPayload?.jti;
  if (!jti) return next();

  try {
    const redis = getRedis();
    const v = await redis.get(`jwt:blacklist:${jti}`);
    if (v) return _res.status(401).json({ code: "TOKEN_REVOKED" });
  } catch {
    // fail-open per spec: availability > perfect revocation
  }

  return next();
}

export async function loadUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const userId = req.jwtPayload?.sub;
  if (!userId) return res.status(401).json({ code: "MISSING_TOKEN" });

  const pool = getPool();
  const u = await pool.query<{
    id: string;
    role: Role;
    is_active: boolean;
    email: string;
    full_name: string;
    student_id: string | null;
  }>("select id, role, is_active, email, full_name, student_id from users where id = $1", [userId]);

  const user = u.rows[0];
  if (!user) return res.status(401).json({ code: "USER_NOT_FOUND" });
  if (!user.is_active) return res.status(401).json({ code: "USER_INACTIVE" });

  req.user = user;
  return next();
}

export function requireRole(...allowed: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role ?? req.jwtPayload?.role;
    if (!role || !allowed.includes(role)) return res.status(403).json({ code: "FORBIDDEN" });
    next();
  };
}

export function requireOwnership(resourceOwnerIdGetter: (req: AuthedRequest) => Promise<string | null>) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== "student") return next();
    const ownerId = await resourceOwnerIdGetter(req);
    if (!ownerId || ownerId !== req.user?.id) return res.status(403).json({ code: "FORBIDDEN" });
    next();
  };
}

