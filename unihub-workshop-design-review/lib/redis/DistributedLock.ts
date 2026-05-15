import { redis } from './redis';
import { v4 as uuidv4 } from 'uuid';

export class DistributedLock {
  /**
   * Acquire a lock for a given resource.
   * @param resource The identifier for the resource (e.g., workshop:id).
   * @param ttl Lock duration in milliseconds.
   * @returns The lock token if acquired, null otherwise.
   */
  public static async acquire(resource: string, ttl: number = 3000): Promise<string | null> {
    const lockKey = `lock:${resource}`;
    const token = uuidv4();

    // NX: Only set if it doesn't exist
    // PX: Set expiration in milliseconds
    const result = await redis.set(lockKey, token, 'PX', ttl, 'NX');

    return result === 'OK' ? token : null;
  }

  /**
   * Release a lock for a given resource.
   * Uses Lua script to ensure atomicity (only release if token matches).
   * @param resource The identifier for the resource.
   * @param token The token returned when the lock was acquired.
   */
  public static async release(resource: string, token: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await redis.eval(luaScript, 1, lockKey, token);
    return result === 1;
  }
}
