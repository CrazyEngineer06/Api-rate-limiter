import { useState, useEffect, useRef, useCallback } from 'react';
import LiveChart from './components/LiveChart';
import DonutChart from './components/DonutChart';
import RequestFeed from './components/RequestFeed';
import TierSelector from './components/TierSelector';
import CursorGlow from './components/CursorGlow';
import './index.css';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
const API_BASE = '';

function AnimatedCounter({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    const duration = 300;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
      else prev.current = end;
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span className="counter-value">{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</span>;
}

export default function App() {
  const [metrics, setMetrics] = useState(null);
  const [connected, setConnected] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkCount, setBenchmarkCount] = useState(10000);
  const [currentConfig, setCurrentConfig] = useState({ algorithm: 'token_bucket' });
  const [selectedTier, setSelectedTier] = useState('free-key-001');
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('[WS] Connected');
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'metrics') {
          setMetrics(data);
          setCurrentConfig(data.config);
        }
      } catch { }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('[WS] Disconnected — reconnecting in 2s');
      reconnectRef.current = setTimeout(connectWs, 2000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connectWs]);

  const runBenchmark = async () => {
    setBenchmarkLoading(true);
    setBenchmarkResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/benchmark?apiKey=${selectedTier}&count=${benchmarkCount}`, { method: 'POST' });
      const data = await res.json();
      setBenchmarkResult(data);
    } catch (err) {
      console.error('Benchmark error:', err);
    }
    setBenchmarkLoading(false);
  };

  const switchAlgorithm = async (algo) => {
    try {
      await fetch(`${API_BASE}/api/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: algo }),
      });
      setCurrentConfig((c) => ({ ...c, algorithm: algo }));
    } catch (err) {
      console.error('Config update error:', err);
    }
  };

  const flushLimits = async () => {
    try {
      await fetch(`${API_BASE}/api/flush`, { method: 'POST' });
    } catch { }
  };

  const timeseries = metrics?.timeseries || [];
  const totals = metrics?.totals || { allowed: 0, blocked: 0, total: 0 };
  const clientLevels = metrics?.clientLevels || {};
  const recentRequests = metrics?.recentRequests || [];

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 relative">
      <CursorGlow />
      
      {/* Header */}
      <header className="flex flex-col items-center text-center justify-center mb-16 mt-8 gap-4">
        <div className="inline-flex items-center justify-center p-2 px-4 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className={`pulse-dot mr-2 ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {connected ? 'System Online' : 'System Offline'}
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontFamily: "'Outfit', sans-serif"
        }}>
          Distributed Rate Limiter
        </h1>
        <p className="text-sm tracking-wide font-light" style={{ color: 'var(--text-muted)' }}>
          Real-time API gateway monitoring • Node <span className="font-medium" style={{ color: 'var(--accent-blue)' }}>{currentConfig.nodeId || 'node-1'}</span>
        </p>
      </header>

      <main className="space-y-2 mt-4 w-full mx-auto">
        {/* Controls Bar */}
        <div className="glass-card flex flex-col md:flex-row items-start md:items-center gap-5 flex-wrap">
          <TierSelector
            currentAlgorithm={currentConfig.algorithm}
            selectedTier={selectedTier}
            onAlgorithmChange={switchAlgorithm}
            onTierChange={setSelectedTier}
          />
          <div className="flex items-center gap-3 ml-auto">
            <button onClick={flushLimits} className="text-xs px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition" style={{ color: 'var(--text-secondary)' }}>
              Reset Limits
            </button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100000"
                value={benchmarkCount}
                onChange={(e) => setBenchmarkCount(Number(e.target.value))}
                className="bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm w-24 outline-none focus:border-white/30 transition-colors"
                style={{ color: 'var(--text-primary)', background: 'rgba(255,255,255,0.05)' }}
              />
              <button onClick={runBenchmark} disabled={benchmarkLoading} className="btn-benchmark">
                {benchmarkLoading ? 'Running...' : 'Run Benchmark'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className="glass-card text-center">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Total Requests</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--accent-blue)' }}>
              <AnimatedCounter value={totals.total} />
            </p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Allowed</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--accent-green)' }}>
              <AnimatedCounter value={totals.allowed} />
            </p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Blocked</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--accent-red)' }}>
              <AnimatedCounter value={totals.blocked} />
            </p>
          </div>
          <div className="glass-card text-center">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Algorithm</p>
            <p className="text-lg font-semibold" style={{ color: 'var(--accent-purple)' }}>
              {currentConfig.algorithm === 'token_bucket' ? 'Token Bucket' : 'Sliding Window'}
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="lg:col-span-2 glass-card">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
              Requests / Second — Rolling 60s
            </h2>
            <LiveChart data={timeseries} />
          </div>
          <div className="glass-card">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
              Allowed vs Blocked
            </h2>
            <DonutChart allowed={totals.allowed} blocked={totals.blocked} />
          </div>
        </div>

        {/* Client Buckets + Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Token Bucket Fill Levels */}
          <div className="glass-card">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
              Token Bucket Fill Levels
            </h2>
            <div className="space-y-4">
              {Object.entries(clientLevels).map(([key, client]) => {
                const pct = client.fillPercent;
                const color = pct > 60 ? 'fill-gradient-green' : pct > 25 ? 'fill-gradient-yellow' : 'fill-gradient-red';
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{client.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{Math.round(client.tokens)}/{client.capacity} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className={`h-full rounded-full ${color} transition-all duration-500 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{client.tier}</p>
                  </div>
                );
              })}
              {Object.keys(clientLevels).length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No active clients yet. Run a benchmark to see data.</p>
              )}
            </div>
          </div>

          {/* Live Request Feed */}
          <div className="lg:col-span-2 glass-card">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
              Live Request Feed
            </h2>
            <RequestFeed requests={recentRequests} />
          </div>
        </div>

        {/* Benchmark Results */}
        {benchmarkResult && (
          <div className="glass-card">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
              Benchmark Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Requests/sec', value: benchmarkResult.requestsPerSecond?.toLocaleString(), color: 'var(--accent-cyan)' },
                { label: 'Allowed', value: `${benchmarkResult.allowedPercent}%`, color: 'var(--accent-green)' },
                { label: 'Blocked', value: `${benchmarkResult.blockedPercent}%`, color: 'var(--accent-red)' },
                { label: 'Avg Latency', value: `${benchmarkResult.latency?.avg}ms`, color: 'var(--accent-blue)' },
                { label: 'P99 Latency', value: `${benchmarkResult.latency?.p99}ms`, color: 'var(--accent-purple)' },
                { label: 'Total Time', value: `${(benchmarkResult.totalTimeMs / 1000).toFixed(1)}s`, color: 'var(--accent-yellow)' },
              ].map((s, i) => (
                <div key={i} className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Distributed Rate Limiter • Redis Lua Atomic Operations • Multi-Node Architecture
        </p>
      </footer>
    </div>
  );
}
