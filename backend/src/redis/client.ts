import Redis from "ioredis";

let _redis: Redis | undefined;

export function getRedis() {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required");

  _redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    commandTimeout: 100,
    // Allow brief enqueue before TCP handshake completes (avoids flaky login on cold start)
    enableOfflineQueue: true
  });

  return _redis;
}

