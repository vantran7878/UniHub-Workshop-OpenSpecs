import { getRedis } from "./client.js";

export type TokenBucketResult =
  | { allowed: true; remainingTokens: number }
  | { allowed: false; retryAfterSeconds: number };

// Simplified token bucket; will be replaced with Lua per spec when we implement auth rate limiting.
export async function tokenBucketConsume(params: {
  key: string;
  maxTokens: number;
  refillPerSecond: number;
}): Promise<TokenBucketResult> {
  const redis = getRedis();
  const nowMs = Date.now();

  const raw = await redis.get(params.key);
  let tokens = params.maxTokens;
  let lastTs = nowMs;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { tokens: number; last_ts: number };
      tokens = parsed.tokens;
      lastTs = parsed.last_ts;
    } catch {
      // ignore corrupt state
      tokens = params.maxTokens;
      lastTs = nowMs;
    }
  }

  const elapsedSeconds = Math.max(0, (nowMs - lastTs) / 1000);
  tokens = Math.min(params.maxTokens, tokens + elapsedSeconds * params.refillPerSecond);

  if (tokens >= 1) {
    tokens -= 1;
    await redis.set(params.key, JSON.stringify({ tokens, last_ts: nowMs }), "EX", 120);
    return { allowed: true, remainingTokens: Math.floor(tokens) };
  }

  const waitSeconds = Math.ceil((1 - tokens) / params.refillPerSecond);
  return { allowed: false, retryAfterSeconds: waitSeconds };
}

