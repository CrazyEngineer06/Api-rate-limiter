/**
 * Express Entry Point
 * Sets up server, routes, WebSocket, and metrics broadcasting
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { config } = require('./config');
const { initRedis, getClientBucketLevels } = require('./rateLimiter');
const { metricsCollector } = require('./metrics');
const apiRoutes = require('./routes/api');
const benchmarkRoutes = require('./routes/benchmark');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: '*',
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After',
  ],
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (!req.path.includes('/health')) {
    console.log(`[${config.nodeId}] ${req.method} ${req.path}`);
  }
  next();
});

// Routes
app.use('/api', apiRoutes);
app.use('/api', benchmarkRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'Distributed Rate Limiter',
    nodeId: config.nodeId,
    endpoints: {
      checkRate: 'GET /api/check-rate',
      benchmark: 'POST /api/benchmark',
      config: 'GET|PATCH /api/config',
      clients: 'GET /api/clients',
      health: 'GET /api/health',
      flush: 'POST /api/flush',
      websocket: 'ws://host/ws',
    },
  });
});

// Start
async function start() {
  // Initialize Redis
  initRedis();

  // Initialize WebSocket & metrics broadcaster
  metricsCollector.initWebSocket(server, getClientBucketLevels);

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║  Distributed Rate Limiter — ${config.nodeId}               ║
║  HTTP:  http://0.0.0.0:${config.port}                       ║
║  WS:    ws://0.0.0.0:${config.port}/ws                      ║
║  Algorithm: ${config.algorithm.padEnd(40)}║
╚══════════════════════════════════════════════════════╝
    `);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
