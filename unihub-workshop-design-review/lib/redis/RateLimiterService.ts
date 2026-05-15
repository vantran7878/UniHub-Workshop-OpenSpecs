import { redis } from './redis';
import * as fs from 'fs';
import * as path from 'path';

const luaScriptPath = path.join(process.cwd(), 'lib/redis/scripts/token_bucket.lua');
const luaScript = fs.readFileSync(luaScriptPath, 'utf8');

export class RateLimiterService {
  /**
   * Check if a request is allowed.
   * @param key Unique key for the rate limit (e.g., ip:endpoint).
   * @param capacity Max tokens.
   * @param refillRate Tokens per millisecond.
   */
  public static async checkLimit(
    key: string,
    capacity: number,
    refillRate: number
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    const fullKey = `rate_limit:${key}`;
    const now = Date.now();

    try {
      const result = (await redis.eval(
        luaScript,
        1,
        fullKey,
        capacity,
        refillRate,
        now,
        1
      )) as [number, number];

      return {
        allowed: result[0] === 1,
        retryAfter: result[1],
      };
    } catch (error) {
      console.error('Rate Limiter Error:', error);
      // Fail-open strategy
      return { allowed: true, retryAfter: 0 };
    }
  }
}
