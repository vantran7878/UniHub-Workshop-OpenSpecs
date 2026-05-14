import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { redis } from '@/lib/redis';

// Note: JWT keys should be correctly formatted strings containing line breaks
const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

export function generateAccessToken(payload: { sub: string; role: string }): string {
  if (!privateKey) {
    throw new Error('JWT_PRIVATE_KEY is not defined');
  }

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export async function storeRefreshTokenHash(userId: string, refreshToken: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const ttlInSeconds = 7 * 24 * 60 * 60; // 7 days
  
  const tokenKey = `refresh_token:${hash}`;
  const userSetKey = `user:${userId}:refresh_tokens`;

  await redis.multi()
    .set(tokenKey, userId, 'EX', ttlInSeconds)
    .sadd(userSetKey, hash)
    .expire(userSetKey, ttlInSeconds)
    .exec();
}

export async function deleteRefreshTokenHash(refreshToken: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const tokenKey = `refresh_token:${hash}`;
  
  const userId = await redis.get(tokenKey);
  if (userId) {
    const userSetKey = `user:${userId}:refresh_tokens`;
    await redis.multi()
      .del(tokenKey)
      .srem(userSetKey, hash)
      .exec();
  } else {
    await redis.del(tokenKey);
  }
}

export async function verifyRefreshTokenHash(refreshToken: string): Promise<string | null> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const tokenKey = `refresh_token:${hash}`;
  return redis.get(tokenKey);
}

export async function blacklistAllTokens(userId: string): Promise<void> {
  const userSetKey = `user:${userId}:refresh_tokens`;
  const hashes = await redis.smembers(userSetKey);
  
  if (hashes.length > 0) {
    const pipeline = redis.pipeline();
    hashes.forEach((hash) => {
      pipeline.del(`refresh_token:${hash}`);
    });
    pipeline.del(userSetKey);
    await pipeline.exec();
  }
}
