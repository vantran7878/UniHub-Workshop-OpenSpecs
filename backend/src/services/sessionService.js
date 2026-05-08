const redisClient = require('../config/redis');
require('dotenv').config();

const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Store a refresh token in Redis.
 * @param {string} token 
 * @param {string} userId 
 * @param {string} role 
 */
async function storeRefreshToken(token, userId, role) {
  const key = `refresh:${token}`;
  const data = JSON.stringify({ userId, role });
  await redisClient.set(key, data, {
    EX: REFRESH_TTL_SEC
  });
}

/**
 * Get a refresh token from Redis.
 * @param {string} token 
 * @returns {Promise<object|null>}
 */
async function getRefreshToken(token) {
  const key = `refresh:${token}`;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Delete a refresh token from Redis.
 * @param {string} token 
 */
async function deleteRefreshToken(token) {
  const key = `refresh:${token}`;
  await redisClient.del(key);
}

/**
 * Blacklist an access token by its jti.
 * @param {string} jti 
 * @param {number} ttlSec 
 */
async function blacklistAccessToken(jti, ttlSec) {
  const key = `jwt:blacklist:${jti}`;
  await redisClient.set(key, "1", {
    EX: ttlSec
  });
}

/**
 * Check if an access token jti is blacklisted.
 * @param {string} jti 
 * @returns {Promise<boolean>}
 */
async function isBlacklisted(jti) {
  const key = `jwt:blacklist:${jti}`;
  const data = await redisClient.get(key);
  return data === "1";
}

module.exports = {
  storeRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  blacklistAccessToken,
  isBlacklisted
};
