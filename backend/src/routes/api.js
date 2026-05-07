/**
 * API Routes
 * - GET /api/check-rate — check rate limit status
 * - GET /api/config — current configuration
 * - PATCH /api/config — hot-reload algorithm/tiers
 * - GET /api/clients — client bucket levels
 * - POST /api/flush — reset all rate limit state
 */

const express = require('express');
const { rateLimitMiddleware } = require('../middleware/rateLimitMiddleware');
const { config, updateConfig, getTierForClient } = require('../config');
const { getClientBucketLevels, flushRateLimits } = require('../rateLimiter');
const { metricsCollector } = require('../metrics');

const router = express.Router();

// ─── Check Rate Limit ─────────────────────────────────────────
router.get('/check-rate', rateLimitMiddleware, (req, res) => {
  res.json({
    allowed: true,
    remaining: req.rateLimit.remaining,
    resetTime: req.rateLimit.resetTime,
    tier: req.rateLimit.tier,
    limit: req.rateLimit.limit,
    algorithm: req.rateLimit.algorithm,
    node: config.nodeId,
  });
});

// ─── Get Config ───────────────────────────────────────────────
router.get('/config', (req, res) => {
  res.json({
    algorithm: config.algorithm,
    tiers: config.tiers,
    nodeId: config.nodeId,
  });
});

// ─── Hot-Reload Config ────────────────────────────────────────
router.patch('/config', (req, res) => {
  try {
    updateConfig(req.body);
    res.json({
      success: true,
      algorithm: config.algorithm,
      tiers: config.tiers,
      message: `Configuration updated. Active algorithm: ${config.algorithm}`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Client Bucket Levels ─────────────────────────────────────
router.get('/clients', async (req, res) => {
  try {
    const levels = await getClientBucketLevels();
    res.json(levels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Flush Rate Limits ────────────────────────────────────────
router.post('/flush', async (req, res) => {
  try {
    await flushRateLimits();
    metricsCollector.reset();
    res.json({ success: true, message: 'All rate limit state flushed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health Check ─────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    nodeId: config.nodeId,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

module.exports = router;
