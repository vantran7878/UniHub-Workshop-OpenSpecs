import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from './redis';
import { NextResponse } from 'next/server';

export const loginRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate_limit_login',
  points: 10,
  duration: 15 * 60, // 15 minutes
});

export const registerRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate_limit_register',
  points: 5,
  duration: 60 * 60, // 1 hour
});

export const refreshRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rate_limit_refresh',
  points: 30,
  duration: 15 * 60, // 15 minutes
});

/**
 * Checks the rate limit for a given IP address.
 * Implements a fail-open strategy: if Redis is unavailable, logs a warning and allows the request.
 * 
 * @param limiter The RateLimiterRedis instance to use
 * @param ipAddress The IP address of the client
 * @returns null if the request is allowed (or fail-open), or a NextResponse with 429 if rate limited
 */
export async function checkRateLimit(
  limiter: RateLimiterRedis,
  ipAddress: string | null
): Promise<NextResponse | null> {
  if (!ipAddress) return null; // If no IP, we can't rate limit effectively

  try {
    await limiter.consume(ipAddress);
    return null; // Request allowed
  } catch (err: any) {
    // rate-limiter-flexible throws an Error if there is a Redis connection issue or other exception
    if (err instanceof Error) {
      console.warn(`[RateLimiter] Fail-open due to error: ${err.message}`);
      return null; // Fail-open: allow request
    }

    // Otherwise, it throws an object containing rate limit info (msBeforeNext, remainingPoints, etc.)
    const retryAfter = Math.round(err.msBeforeNext / 1000) || 1;
    
    return NextResponse.json(
      { message: 'Too Many Requests' },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }
}
