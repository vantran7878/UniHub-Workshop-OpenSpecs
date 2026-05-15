-- Token Bucket algorithm in Lua for Redis
-- KEYS[1]: The key for the bucket (e.g., rate_limit:login:user_id)
-- ARGV[1]: Max capacity of the bucket
-- ARGV[2]: Refill rate (tokens per millisecond)
-- ARGV[3]: Current timestamp in milliseconds
-- ARGV[4]: Tokens to consume (usually 1)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call("hmget", key, "tokens", "last_refill")
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    last_refill = now
else
    local elapsed = math.max(0, now - last_refill)
    tokens = math.min(capacity, tokens + (elapsed * refill_rate))
    last_refill = now
end

local allowed = 0
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    retry_after = math.ceil((requested - tokens) / refill_rate)
end

redis.call("hmset", key, "tokens", tokens, "last_refill", last_refill)
redis.call("pexpire", key, math.ceil(capacity / refill_rate))

return {allowed, retry_after}
