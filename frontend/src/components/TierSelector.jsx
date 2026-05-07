export default function TierSelector({ currentAlgorithm, selectedTier, onAlgorithmChange, onTierChange }) {
  const isTokenBucket = currentAlgorithm === 'token_bucket';

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Algorithm Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium" style={{
          color: !isTokenBucket ? 'var(--accent-blue)' : 'var(--text-muted)'
        }}>
          Sliding Window
        </span>
        <div
          className={`toggle-track ${isTokenBucket ? 'active' : ''}`}
          onClick={() => onAlgorithmChange(isTokenBucket ? 'sliding_window' : 'token_bucket')}
          role="switch"
          aria-checked={isTokenBucket}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAlgorithmChange(isTokenBucket ? 'sliding_window' : 'token_bucket');
            }
          }}
        >
          <div className="toggle-thumb" />
        </div>
        <span className="text-xs font-medium" style={{
          color: isTokenBucket ? 'var(--accent-blue)' : 'var(--text-muted)'
        }}>
          Token Bucket
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.1)' }} />

      {/* Tier Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Client Tier:</span>
        <select
          value={selectedTier}
          onChange={(e) => onTierChange(e.target.value)}
          className="select-glass"
          id="tier-selector"
        >
          <option value="free-key-001">🆓 Free (10 req/s)</option>
          <option value="pro-key-001">⚡ Pro (100 req/s)</option>
          <option value="enterprise-key-001">🏢 Enterprise (1000 req/s)</option>
        </select>
      </div>
    </div>
  );
}
