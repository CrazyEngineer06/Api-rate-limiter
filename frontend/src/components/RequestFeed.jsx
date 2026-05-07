import { useRef, useEffect, useState } from 'react';

export default function RequestFeed({ requests }) {
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [requests, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  if (requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No requests yet. Run a benchmark to populate the feed.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table Header */}
      <div className="grid grid-cols-6 gap-2 text-[10px] uppercase tracking-wider px-3 pb-2 border-b border-white/5"
        style={{ color: 'var(--text-muted)' }}>
        <span>Time</span>
        <span>Client</span>
        <span>Tier</span>
        <span>Status</span>
        <span>Remaining</span>
        <span>Latency</span>
      </div>

      {/* Scrollable Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{ maxHeight: '320px' }}
      >
        {requests.map((req, i) => (
          <div
            key={i}
            className="feed-row grid grid-cols-6 gap-2 text-xs px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
          >
            <span style={{ color: 'var(--text-muted)' }}>
              {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={{ color: 'var(--text-secondary)' }} className="truncate">
              {req.client}
            </span>
            <span>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  background: req.tier === 'enterprise' ? 'rgba(168,85,247,0.15)' :
                    req.tier === 'pro' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)',
                  color: req.tier === 'enterprise' ? '#c084fc' :
                    req.tier === 'pro' ? '#93c5fd' : '#94a3b8',
                }}>
                {req.tier}
              </span>
            </span>
            <span>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${req.status === 'allowed' ? 'badge-allowed' : 'badge-blocked'}`}>
                {req.status === 'allowed' ? '✓ OK' : '✗ 429'}
              </span>
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {req.remaining}
            </span>
            <span style={{ color: parseFloat(req.latency) > 5 ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
              {req.latency}ms
            </span>
          </div>
        ))}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <div className="text-center py-2">
          <button
            onClick={() => setAutoScroll(true)}
            className="text-[10px] px-3 py-1 rounded-full border border-white/10 hover:bg-white/5 transition"
            style={{ color: 'var(--text-muted)' }}
          >
            ↓ Resume auto-scroll
          </button>
        </div>
      )}
    </div>
  );
}
