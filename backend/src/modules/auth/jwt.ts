import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";

type Role = "student" | "admin" | "staff";

export type JwtPayload = {
  sub: string;
  role: Role;
  email: string;
  jti: string;
  iat: number;
  exp: number;
};

let _privateKey: CryptoKey | undefined;
let _publicKey: CryptoKey | undefined;

async function getPrivateKey() {
  if (_privateKey) return _privateKey;
  const p = process.env.JWT_PRIVATE_KEY_PATH;
  if (!p) throw new Error("JWT_PRIVATE_KEY_PATH is required");
  const pem = await readFile(p, "utf8");
  _privateKey = await importPKCS8(pem, "RS256");
  return _privateKey;
}

async function getPublicKey() {
  if (_publicKey) return _publicKey;
  const p = process.env.JWT_PUBLIC_KEY_PATH;
  if (!p) throw new Error("JWT_PUBLIC_KEY_PATH is required");
  const pem = await readFile(p, "utf8");
  _publicKey = await importSPKI(pem, "RS256");
  return _publicKey;
}

export function accessTokenTtlSeconds(role: Role) {
  if (role === "staff") return 8 * 60 * 60;
  return 15 * 60;
}

export async function signAccessToken(input: { userId: string; role: Role; email: string }) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = accessTokenTtlSeconds(input.role);
  const jti = randomUUID();
  const privateKey = await getPrivateKey();

  const token = await new SignJWT({ role: input.role, email: input.email })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setSubject(input.userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .setJti(jti)
    .sign(privateKey);

  return { token, jti, exp: now + ttl };
}

export async function verifyAccessToken(token: string) {
  const publicKey = await getPublicKey();
  const result = await jwtVerify(token, publicKey, { algorithms: ["RS256"] });
  const payload = result.payload as unknown as JwtPayload;
  return payload;
}

