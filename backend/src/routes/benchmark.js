/**
 * Benchmark Route
 * Fires 10,000 concurrent rate limit checks and returns performance metrics
 */

const express = require('express');
const { checkRateLimit } = require('../rateLimiter');
const { config } = require('../config');
const { metricsCollector } = require('../metrics');

const router = express.Router();

router.post('/benchmark', async (req, res) => {
  const totalRequests = parseInt(req.query.count) || 10000;
  const apiKey = req.query.apiKey || 'free-key-001';
  const batchSize = parseInt(req.query.batchSize) || 1000;

  console.log(`[Benchmark] Starting ${totalRequests} requests, key=${apiKey}`);

  const latencies = [];
  let allowed = 0;
  let blocked = 0;
  const startTime = performance.now();

  for (let i = 0; i < totalRequests; i += batchSize) {
    const batch = Math.min(batchSize, totalRequests - i);
    const promises = [];

    for (let j = 0; j < batch; j++) {
      const idx = i + j;
      const clientKey = `${apiKey}:bench-${idx % 10}`;
      promises.push(
        (async () => {
          const s = performance.now();
          try {
            const result = await checkRateLimit(clientKey, apiKey);
            const lat = performance.now() - s;
            latencies.push(lat);
            if (result.allowed) allowed++; else blocked++;
            metricsCollector.recordRequest({
              timestamp: Date.now(), clientKey: apiKey,
              tier: result.tier, allowed: result.allowed,
              remaining: result.remaining, latency: lat,
              algorithm: result.algorithm,
            });
          } catch {
            latencies.push(performance.now() - s);
            blocked++;
          }
        })()
      );
    }
    await Promise.all(promises);
  }

  const totalTime = performance.now() - startTime;
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  const results = {
    totalRequests,
    totalTimeMs: +totalTime.toFixed(2),
    requestsPerSecond: +((totalRequests / totalTime) * 1000).toFixed(0),
    allowed, blocked,
    allowedPercent: +((allowed / totalRequests) * 100).toFixed(2),
    blockedPercent: +((blocked / totalRequests) * 100).toFixed(2),
    latency: {
      avg: +avg.toFixed(3),
      min: +latencies[0].toFixed(3),
      max: +latencies[latencies.length - 1].toFixed(3),
      p50: +latencies[Math.floor(latencies.length * 0.5)].toFixed(3),
      p95: +latencies[Math.floor(latencies.length * 0.95)].toFixed(3),
      p99: +latencies[Math.floor(latencies.length * 0.99)].toFixed(3),
    },
    config: { algorithm: config.algorithm, apiKey, nodeId: config.nodeId },
  };

  console.log(`[Benchmark] Done: ${results.requestsPerSecond} req/s, p99=${results.latency.p99}ms`);
  res.json(results);
});

router.get('/benchmark', async (req, res) => {
  const totalRequests = 10000;
  const latencies = [];
  let allowed = 0;
  let blocked = 0;
  const startTime = performance.now();

  const promises = [];
  for (let i = 0; i < totalRequests; i++) {
    const clientKey = `client-${Math.floor(Math.random() * 100)}`;
    promises.push(
      (async () => {
        const s = performance.now();
        try {
          const result = await checkRateLimit(clientKey, 'free-key-001');
          const lat = performance.now() - s;
          latencies.push(lat);
          if (result.allowed) allowed++; else blocked++;
        } catch {
          latencies.push(performance.now() - s);
          blocked++;
        }
      })()
    );
  }

  await Promise.all(promises);

  const totalTime = performance.now() - startTime;
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  const results = {
    totalRequests,
    duration: `${Math.round(totalTime)}ms`,
    allowed,
    blocked,
    rps: Math.round((totalRequests / totalTime) * 1000),
    avgLatency: `${avg.toFixed(2)}ms`,
    p99Latency: `${p99.toFixed(1)}ms`
  };

  res.json(results);
});

module.exports = router;
