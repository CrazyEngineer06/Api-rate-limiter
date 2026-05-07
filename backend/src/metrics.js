/**
 * Metrics Collector & WebSocket Broadcaster
 * Collects request metrics and broadcasts to dashboard every 500ms
 */

const WebSocket = require('ws');
const { config } = require('./config');

class MetricsCollector {
  constructor() {
    // Ring buffer for request events (last 60 seconds)
    this.requestLog = [];
    this.maxLogSize = 200; // keep last 200 entries for feed

    // Timeseries data (per-second buckets for 60s)
    this.timeseries = [];
    this.maxTimeseriesPoints = 120; // 60 seconds at 500ms intervals

    // Current interval counters
    this.currentAllowed = 0;
    this.currentBlocked = 0;
    this.currentLatencies = [];

    // Cumulative totals
    this.totalAllowed = 0;
    this.totalBlocked = 0;

    // WebSocket server reference
    this.wss = null;

    // Broadcast interval
    this.broadcastInterval = null;
  }

  /**
   * Record a request event
   */
  recordRequest(event) {
    // Update counters
    if (event.allowed) {
      this.currentAllowed++;
      this.totalAllowed++;
    } else {
      this.currentBlocked++;
      this.totalBlocked++;
    }

    this.currentLatencies.push(event.latency);

    // Add to request log
    this.requestLog.push({
      timestamp: event.timestamp,
      client: event.clientKey,
      tier: event.tier,
      status: event.allowed ? 'allowed' : 'blocked',
      remaining: event.remaining,
      latency: event.latency.toFixed(2),
      algorithm: event.algorithm,
    });

    // Trim log
    if (this.requestLog.length > this.maxLogSize) {
      this.requestLog = this.requestLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Snapshot current interval and push to timeseries
   */
  snapshot() {
    const now = Date.now();
    const total = this.currentAllowed + this.currentBlocked;
    const avgLatency = this.currentLatencies.length > 0
      ? this.currentLatencies.reduce((a, b) => a + b, 0) / this.currentLatencies.length
      : 0;
    const p99Latency = this.percentile(this.currentLatencies, 99);

    const point = {
      time: now,
      requestsPerSec: total * 2, // multiply by 2 since interval is 500ms
      allowed: this.currentAllowed,
      blocked: this.currentBlocked,
      avgLatency: parseFloat(avgLatency.toFixed(2)),
      p99Latency: parseFloat(p99Latency.toFixed(2)),
    };

    this.timeseries.push(point);
    if (this.timeseries.length > this.maxTimeseriesPoints) {
      this.timeseries.shift();
    }

    // Reset interval counters
    this.currentAllowed = 0;
    this.currentBlocked = 0;
    this.currentLatencies = [];

    return point;
  }

  /**
   * Get broadcast payload
   */
  async getPayload(getClientLevels) {
    const point = this.snapshot();
    let clientLevels = {};
    
    try {
      clientLevels = await getClientLevels();
    } catch (err) {
      // Ignore — client levels are optional
    }

    return {
      type: 'metrics',
      timeseries: this.timeseries,
      current: point,
      totals: {
        allowed: this.totalAllowed,
        blocked: this.totalBlocked,
        total: this.totalAllowed + this.totalBlocked,
      },
      recentRequests: this.requestLog.slice(-50),
      clientLevels,
      config: {
        algorithm: config.algorithm,
        nodeId: config.nodeId,
      },
    };
  }

  /**
   * Initialize WebSocket server and start broadcasting
   */
  initWebSocket(server, getClientLevels) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      console.log(`[WS] Client connected (total: ${this.wss.clients.size})`);

      ws.on('close', () => {
        console.log(`[WS] Client disconnected (total: ${this.wss.clients.size})`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Error:', err.message);
      });
    });

    // Broadcast every 500ms
    this.broadcastInterval = setInterval(async () => {
      if (this.wss.clients.size === 0) return;

      try {
        const payload = await this.getPayload(getClientLevels);
        const data = JSON.stringify(payload);

        this.wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(data);
          }
        });
      } catch (err) {
        console.error('[WS] Broadcast error:', err.message);
      }
    }, 500);

    console.log('[WS] WebSocket server initialized on /ws');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.requestLog = [];
    this.timeseries = [];
    this.currentAllowed = 0;
    this.currentBlocked = 0;
    this.currentLatencies = [];
    this.totalAllowed = 0;
    this.totalBlocked = 0;
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

module.exports = { metricsCollector };
