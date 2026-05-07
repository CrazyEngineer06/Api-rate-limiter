import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#22c55e', '#ef4444'];

function RenderLabel({ cx, cy, value, name }) {
  return null; // Labels rendered separately below
}

export default function DonutChart({ allowed, blocked }) {
  const total = allowed + blocked;

  const data = useMemo(() => [
    { name: 'Allowed', value: allowed || 0 },
    { name: 'Blocked', value: blocked || 0 },
  ], [allowed, blocked]);

  const allowedPct = total > 0 ? ((allowed / total) * 100).toFixed(1) : '0.0';
  const blockedPct = total > 0 ? ((blocked / total) * 100).toFixed(1) : '0.0';

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No data yet</p>
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} style={{ filter: `drop-shadow(0 0 6px ${COLORS[i]}40)` }} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'rgba(17,24,39,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value, name) => [value.toLocaleString(), name]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Allowed <strong style={{ color: '#4ade80' }}>{allowedPct}%</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Blocked <strong style={{ color: '#f87171' }}>{blockedPct}%</strong>
          </span>
        </div>
      </div>

      {/* Center text */}
      <div className="text-center -mt-1">
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{total.toLocaleString()} total</p>
      </div>
    </div>
  );
}
