import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(17, 24, 39, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      padding: '10px 15px',
      fontSize: '12px',
    }}>
      <p style={{ color: '#94a3b8', marginBottom: 4 }}>
        {new Date(label).toLocaleTimeString()}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function LiveChart({ data }) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      time: d.time,
      'req/s': d.requestsPerSec,
      allowed: d.allowed * 2,
      blocked: d.blocked * 2,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">Waiting for data... Run a benchmark or send requests.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
        <defs>
          <linearGradient id="gradientReqs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradientAllowed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradientBlocked" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="time"
          tickFormatter={(t) => new Date(t).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
          stroke="rgba(255,255,255,0.15)"
          tick={{ fontSize: 10, fill: '#64748b' }}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="rgba(255,255,255,0.15)"
          tick={{ fontSize: 10, fill: '#64748b' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="req/s" stroke="#3b82f6" fill="url(#gradientReqs)" strokeWidth={2} name="Total req/s" dot={false} animationDuration={300} />
        <Area type="monotone" dataKey="allowed" stroke="#22c55e" fill="url(#gradientAllowed)" strokeWidth={1.5} name="Allowed/s" dot={false} animationDuration={300} />
        <Area type="monotone" dataKey="blocked" stroke="#ef4444" fill="url(#gradientBlocked)" strokeWidth={1.5} name="Blocked/s" dot={false} animationDuration={300} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
