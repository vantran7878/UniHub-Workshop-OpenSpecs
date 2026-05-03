import { getRedis } from "../../redis/client.js";

/** Invalidate list cache, stats cache, and per-workshop keys (detail + seat counters). */
export async function invalidateWorkshopCaches(workshopId?: string) {
  const redis = getRedis();
  const listKeys = await redis.keys("workshop:list:*");
  if (listKeys.length) await redis.del(...listKeys);
  await redis.del("workshop:statistics");
  if (workshopId) {
    await redis.del(`workshop:${workshopId}:cached`);
    await redis.del(`workshop:${workshopId}:seats_available`);
    await redis.del(`workshop:${workshopId}:registered_count`);
  }
}
