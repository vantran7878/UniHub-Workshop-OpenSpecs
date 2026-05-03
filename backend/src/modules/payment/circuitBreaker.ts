import { getRedis } from "../../redis/client.js";

const KEY = "circuit:payment_gateway";
const TTL_SEC = 600;

export type CbState = "CLOSED" | "OPEN" | "HALF_OPEN";

type Stored = {
  state: CbState;
  failure_count: number;
  last_failure_at: number;
  opened_at: number;
  success_count_half_open: number;
};

const failureThreshold = 5;
const windowMs = 30_000;
const openTimeoutMs = 60_000;
const successThreshold = 2;

export async function circuitAllows(): Promise<boolean> {
  const redis = getRedis();
  const raw = await redis.get(KEY);
  const now = Date.now();
  if (!raw) return true;
  let s: Stored;
  try {
    s = JSON.parse(raw) as Stored;
  } catch {
    return true;
  }
  if (s.state === "OPEN") {
    if (now - s.opened_at >= openTimeoutMs) {
      s.state = "HALF_OPEN";
      s.success_count_half_open = 0;
      await redis.set(KEY, JSON.stringify(s), "EX", TTL_SEC);
      return true;
    }
    return false;
  }
  if (s.state === "HALF_OPEN") return true;
  return true;
}

export async function recordSuccess() {
  const redis = getRedis();
  const raw = await redis.get(KEY);
  const now = Date.now();
  if (!raw) return;
  const s = JSON.parse(raw) as Stored;
  if (s.state === "HALF_OPEN") {
    s.success_count_half_open += 1;
    if (s.success_count_half_open >= successThreshold) {
      await redis.del(KEY);
      return;
    }
  } else {
    s.failure_count = 0;
  }
  await redis.set(KEY, JSON.stringify(s), "EX", TTL_SEC);
}

export async function recordFailure(isGatewayError: boolean) {
  if (!isGatewayError) return;
  const redis = getRedis();
  const now = Date.now();
  const raw = (await redis.get(KEY)) ?? JSON.stringify({ state: "CLOSED" as CbState, failure_count: 0, last_failure_at: 0, opened_at: 0, success_count_half_open: 0 });
  const s = JSON.parse(raw) as Stored;

  if (s.state === "HALF_OPEN") {
    s.state = "OPEN";
    s.opened_at = now;
    s.failure_count = 0;
    await redis.set(KEY, JSON.stringify(s), "EX", TTL_SEC);
    return;
  }

  if (now - s.last_failure_at > windowMs) s.failure_count = 0;
  s.failure_count += 1;
  s.last_failure_at = now;
  if (s.failure_count >= failureThreshold) {
    s.state = "OPEN";
    s.opened_at = now;
  }
  await redis.set(KEY, JSON.stringify(s), "EX", TTL_SEC);
}
