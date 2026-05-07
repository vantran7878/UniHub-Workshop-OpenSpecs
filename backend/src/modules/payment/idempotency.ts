import { getRedis } from "../../redis/client.js";

const TTL_SEC = 24 * 60 * 60;

export type PaymentIdemState =
  | { status: "processing" }
  | { status: "success"; qr_code: string; registration_id: string; transaction_id?: string }
  | { status: "failed"; reason?: string }
  | { status: "pending"; transaction_id?: string };

export function paymentIdemKey(userId: string, workshopId: string, clientKey: string) {
  return `idempotent:payment:${userId}:${workshopId}:${clientKey}`;
}

export async function getPaymentIdem(key: string): Promise<PaymentIdemState | null> {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaymentIdemState;
  } catch {
    return null;
  }
}

export async function setPaymentIdem(key: string, state: PaymentIdemState) {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(state), "EX", TTL_SEC);
}

/** Atomic-ish: SET key if not exists with processing state */
export async function tryMarkProcessing(key: string): Promise<boolean> {
  const redis = getRedis();
  const processing: PaymentIdemState = { status: "processing" };
  const res = await redis.set(key, JSON.stringify(processing), "EX", TTL_SEC, "NX");
  return res === "OK";
}
