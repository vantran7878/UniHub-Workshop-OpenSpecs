const redisClient = require('../config/redis');

const LUA_SCRIPT = `
local key        = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now        = tonumber(ARGV[3])

local data = redis.call('GET', key)
local tokens, last_ts

if data then
  local parsed  = cjson.decode(data)
  tokens  = parsed.tokens
  last_ts = parsed.last_ts
  local elapsed = (now - last_ts) / 1000
  tokens = math.min(max_tokens, tokens + elapsed * refill_rate)
else
  tokens  = max_tokens
  last_ts = now
end

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('SET', key, cjson.encode({tokens=tokens, last_ts=now}), 'EX', 120)
  return {1, tokens}
else
  local wait = math.ceil((1 - tokens) / refill_rate)
  return {0, wait}
end
`;

/**
 * Middleware for rate limiting using Token Bucket (Redis Lua).
 * @param {string} type 
 * @param {number} maxTokens 
 * @param {number} refillRate (tokens per second)
 */
function rateLimit(type, maxTokens, refillRate) {
  return async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const key = `ratelimit:ip:${ip}:${type}`;
    const now = Date.now();

    try {
      // redis-v4/v5 library script execution
      const result = await redisClient.eval(LUA_SCRIPT, {
        keys: [key],
        arguments: [maxTokens.toString(), refillRate.toString(), now.toString()]
      });

      const [allowed, value] = result;

      if (allowed === 1) {
        next();
      } else {
        res.set('Retry-After', value);
        res.status(429).json({ code: 'TOO_MANY_REQUESTS', retryAfter: value });
      }
    } catch (err) {
      console.error('Rate limit error (fail-open):', err);
      next();
    }
  };
}

module.exports = rateLimit;
