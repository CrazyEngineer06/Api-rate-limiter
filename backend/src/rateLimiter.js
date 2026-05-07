/**
 * Rate Limiter Engine
 * Implements Token Bucket & Sliding Window Log via Redis Lua scripts
 * All operations are atomic — zero race conditions under concurrent load
 */

const Redis = require('ioredis');
const { config, getTierForClient } = require('./config');

let redis = null;

// ─── Lua Scripts ──────────────────────────────────────────────

/**
 * Token Bucket Algorithm (Lua Script)
 * 
 * Keys: [bucket_key]
 * Args: [capacity, refill_rate, now_ms]
 * 
 * Returns: [allowed (0/1), remaining_tokens, reset_time_ms]
 * 
 * How it works:
 * 1. Read current tokens and last_refill from hash
 * 2. Calculate elapsed time and refill tokens
 * 3. If tokens >= 1, consume one and allow
 * 4. Otherwise, deny and return time until next token
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  last_refill = now
end

local elapsed = (now - last_refill) / 1000.0
local refill = math.floor(elapsed * refill_rate)

if refill > 0 then
  tokens = math.min(capacity, tokens + refill)
  last_refill = now
end

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('PEXPIRE', key, 60000)

local reset_ms = 0
if tokens < 1 then
  reset_ms = math.ceil(1000.0 / refill_rate)
end

return {allowed, math.floor(tokens), now + reset_ms}
`;

/**
 * Sliding Window Log Algorithm (Lua Script)
 * 
 * Keys: [sorted_set_key]
 * Args: [window_ms, max_requests, now_ms, request_id]
 * 
 * Returns: [allowed (0/1), remaining_requests, reset_time_ms]
 * 
 * How it works:
 * 1. Remove all entries older than (now - window_ms)
 * 2. Count current entries in the window
 * 3. If count < max_requests, add new entry and allow
 * 4. Otherwise, deny and return window reset time
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local window_ms = tonumber(ARGV[1])
local max_requests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local request_id = ARGV[4]

local window_start = now - window_ms

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

local current_count = redis.call('ZCARD', key)

local allowed = 0
local remaining = max_requests - current_count

if current_count < max_requests then
  redis.call('ZADD', key, now, request_id)
  allowed = 1
  remaining = remaining - 1
end

redis.call('PEXPIRE', key, window_ms + 1000)

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset_time = now + window_ms
if #oldest >= 2 then
  reset_time = tonumber(oldest[2]) + window_ms
end

return {allowed, math.max(0, remaining), reset_time}
`;

// ─── Engine ───────────────────────────────────────────────────

function initRedis() {
  if (redis) return redis;

  const redisOptions = {
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    enableReadyCheck: config.redis.enableReadyCheck,
    lazyConnect: config.redis.lazyConnect,
    enableOfflineQueue: config.redis.enableOfflineQueue,
  };

  if (config.redis.url) {
    redis = new Redis(config.redis.url, redisOptions);
  } else {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      ...redisOptions
    });
  }

  // Register Lua scripts as custom commands
  redis.defineCommand('tokenBucket', {
    numberOfKeys: 1,
    lua: TOKEN_BUCKET_SCRIPT,
  });

  redis.defineCommand('slidingWindow', {
    numberOfKeys: 1,
    lua: SLIDING_WINDOW_SCRIPT,
  });

  redis.on('error', (err) => {
    console.error(`[Redis] Connection error: ${err.message}`);
  });

  redis.on('connect', () => {
    console.log(`[Redis] Connected to ${config.redis.host}:${config.redis.port}`);
  });

  redis.connect().catch((err) => {
    console.error(`[Redis] Initial connection failed: ${err.message}`);
  });

  return redis;
}

/**
 * Check rate limit for a client
 * @param {string} clientKey - Unique client identifier (apiKey:ip)
 * @param {string} apiKey - API key for tier lookup
 * @returns {Object} { allowed, remaining, resetTime, tier, algorithm }
 */
async function checkRateLimit(clientKey, apiKey) {
  const r = initRedis();
  const tierConfig = getTierForClient(apiKey);
  const algorithm = config.algorithm;
  const now = Date.now();

  let result;

  if (algorithm === 'token_bucket') {
    const key = `ratelimit:tb:${clientKey}`;
    result = await r.tokenBucket(
      key,
      tierConfig.bucketCapacity,
      tierConfig.refillRate,
      now
    );
  } else {
    // sliding_window
    const key = `ratelimit:swl:${clientKey}`;
    const requestId = `${now}:${Math.random().toString(36).substring(2, 10)}`;
    result = await r.slidingWindow(
      key,
      tierConfig.windowSizeMs,
      tierConfig.requestsPerSecond,
      now,
      requestId
    );
  }

  return {
    allowed: result[0] === 1,
    remaining: result[1],
    resetTime: result[2],
    tier: tierConfig.tierName,
    limit: tierConfig.requestsPerSecond,
    algorithm,
  };
}

/**
 * Get token bucket fill levels for all active clients
 */
async function getClientBucketLevels() {
  const r = initRedis();
  const levels = {};

  for (const [apiKey, clientInfo] of Object.entries(config.clients)) {
    const tierConfig = getTierForClient(apiKey);
    const key = `ratelimit:tb:${apiKey}`;

    try {
      const data = await r.hmget(key, 'tokens', 'last_refill');
      const tokens = data[0] !== null ? parseFloat(data[0]) : tierConfig.bucketCapacity;
      levels[apiKey] = {
        name: clientInfo.name,
        tier: clientInfo.tier,
        tokens: Math.max(0, tokens),
        capacity: tierConfig.bucketCapacity,
        fillPercent: Math.min(100, Math.max(0, (tokens / tierConfig.bucketCapacity) * 100)),
      };
    } catch {
      levels[apiKey] = {
        name: clientInfo.name,
        tier: clientInfo.tier,
        tokens: tierConfig.bucketCapacity,
        capacity: tierConfig.bucketCapacity,
        fillPercent: 100,
      };
    }
  }

  return levels;
}

/**
 * Flush all rate limit keys (for testing)
 */
async function flushRateLimits() {
  const r = initRedis();
  const keys = await r.keys('ratelimit:*');
  if (keys.length > 0) {
    await r.del(...keys);
  }
}

function getRedisClient() {
  return initRedis();
}

module.exports = {
  initRedis,
  checkRateLimit,
  getClientBucketLevels,
  flushRateLimits,
  getRedisClient,
};
