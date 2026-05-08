const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * Acquire a distributed lock.
 * @param {string} key Lock key.
 * @param {number} ttl Time to live in seconds.
 * @returns {Promise<boolean>} True if lock acquired.
 */
async function acquireLock(key, ttl = 300) {
  const result = await redis.set(key, Date.now(), 'EX', ttl, 'NX');
  return result === 'OK';
}

/**
 * Release a distributed lock.
 * @param {string} key Lock key.
 */
async function releaseLock(key) {
  await redis.del(key);
}

module.exports = {
  redis,
  acquireLock,
  releaseLock
};
