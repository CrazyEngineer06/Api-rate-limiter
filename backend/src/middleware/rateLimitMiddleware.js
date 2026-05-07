/**
 * Rate Limit Middleware
 * Applies rate limiting to incoming requests and sets response headers
 */

const { checkRateLimit } = require('../rateLimiter');
const { metricsCollector } = require('../metrics');

async function rateLimitMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || 'demo-key';
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const clientKey = `${apiKey}:${ip}`;

  const start = performance.now();

  try {
    const result = await checkRateLimit(clientKey, apiKey);
    const latency = performance.now() - start;

    // Set rate limit headers on every response
    res.set('X-RateLimit-Limit', String(result.limit));
    res.set('X-RateLimit-Remaining', String(result.remaining));
    res.set('X-RateLimit-Reset', String(result.resetTime));

    // Emit metrics
    metricsCollector.recordRequest({
      timestamp: Date.now(),
      clientKey: apiKey,
      tier: result.tier,
      allowed: result.allowed,
      remaining: result.remaining,
      latency,
      algorithm: result.algorithm,
    });

    if (!result.allowed) {
      const retryAfter = Math.max(0, result.resetTime - Date.now());
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too Many Requests',
        allowed: false,
        remaining: result.remaining,
        resetTime: result.resetTime,
        retryAfter,
        tier: result.tier,
      });
    }

    // Attach result to request for downstream use
    req.rateLimit = result;
    next();
  } catch (err) {
    console.error('[RateLimitMiddleware] Error:', err.message);
    // Fail open — allow request if rate limiter is down
    next();
  }
}

module.exports = { rateLimitMiddleware };
