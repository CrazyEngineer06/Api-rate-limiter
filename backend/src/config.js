/**
 * Rate Limiter Configuration
 * Hot-reloadable via PATCH /api/config
 */

const config = {
  // Active algorithm: 'token_bucket' or 'sliding_window'
  algorithm: 'token_bucket',

  // Redis connection
  redis: {
    url: process.env.REDIS_URL || null,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    enableOfflineQueue: false,
  },

  // Tier limits configuration
  tiers: {
    free: {
      requestsPerSecond: 10,
      bucketCapacity: 10,
      refillRate: 10,        // tokens per second
      windowSizeMs: 1000,    // 1 second window for sliding window
    },
    pro: {
      requestsPerSecond: 100,
      bucketCapacity: 100,
      refillRate: 100,
      windowSizeMs: 1000,
    },
    enterprise: {
      requestsPerSecond: 1000,
      bucketCapacity: 1000,
      refillRate: 1000,
      windowSizeMs: 1000,
    },
  },

  // Registered clients (API key -> tier mapping)
  clients: {
    'free-key-001': { tier: 'free', name: 'Free User' },
    'pro-key-001': { tier: 'pro', name: 'Pro User' },
    'enterprise-key-001': { tier: 'enterprise', name: 'Enterprise User' },
    'demo-key': { tier: 'free', name: 'Demo Client' },
  },

  // Server
  port: parseInt(process.env.PORT) || 8080,
  nodeId: process.env.NODE_ID || 'node-1',
};

/**
 * Get tier config for a client
 */
function getTierForClient(apiKey) {
  const client = config.clients[apiKey];
  const tierName = client ? client.tier : 'free';
  return { tierName, ...config.tiers[tierName] };
}

/**
 * Update config (hot-reload)
 */
function updateConfig(updates) {
  if (updates.algorithm) {
    if (!['token_bucket', 'sliding_window'].includes(updates.algorithm)) {
      throw new Error(`Invalid algorithm: ${updates.algorithm}`);
    }
    config.algorithm = updates.algorithm;
  }
  if (updates.tiers) {
    Object.assign(config.tiers, updates.tiers);
  }
}

module.exports = { config, getTierForClient, updateConfig };
