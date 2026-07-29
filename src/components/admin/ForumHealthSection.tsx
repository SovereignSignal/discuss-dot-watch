'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

interface ForumHealth {
  name: string;
  url: string;
  status: 'ok' | 'error' | 'not_cached';
  topicCount: number;
  lastFetched: number | null;
  error?: string;
  consecutiveFailures: number;
  lastSuccess: number | null;
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

function formatTimeSince(ts: number | null): string {
  if (!ts) return 'never';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ForumHealthSection({ getAuthHeaders }: { getAuthHeaders: () => Promise<Record<string, string>>; isDark?: boolean }) {
  const [results, setResults] = useState<ForumHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'issues'>('issues');

  const fhCardBg = 'var(--ds-bg-card)';
  const fhCardBorder = 'var(--ds-border)';
  const fhTextPrimary = 'var(--ds-fg)';
  const fhTextMuted = 'var(--ds-fg-muted)';
  const fhTextDim = 'var(--ds-fg-dim)';
  const fhBtnBg = 'var(--ds-bg-elev)';
  const fhBtnBorder = 'var(--ds-border)';

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/admin?action=forum-health', {
        headers: authHeaders,
      });
      const data = await res.json();
      setResults(data.forums || []);
    } catch {
      console.error('Failed to fetch forum health');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  // Fetch on mount
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const issues = results.filter(r => r.status === 'error' || r.consecutiveFailures > 0);
  const notCached = results.filter(r => r.status === 'not_cached');
  const ok = results.filter(r => r.status === 'ok' && r.consecutiveFailures === 0);
  const displayResults = filter === 'issues'
    ? [...issues].sort((a, b) => b.consecutiveFailures - a.consecutiveFailures)
    : results;

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: fhCardBg, border: `1px solid ${fhCardBorder}` }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium" style={{ color: fhTextPrimary }}>Forum Health</h2>
          <p className="text-xs mt-0.5" style={{ color: fhTextDim }}>Consecutive failures persist across refresh cycles</p>
        </div>
        <div className="flex items-center gap-3">
          {results.length > 0 && (
            <div className="flex items-center gap-3 text-sm" style={{ color: fhTextMuted }}>
              <span style={{ color: '#22c55e' }}>{ok.length} ok</span>
              {issues.length > 0 && <span style={{ color: '#ef4444' }}>{issues.length} failing</span>}
              {notCached.length > 0 && <span style={{ color: fhTextDim }}>{notCached.length} not cached</span>}
            </div>
          )}
          <button onClick={fetchHealth} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
            style={{ backgroundColor: fhBtnBg, border: `1px solid ${fhBtnBorder}`, color: fhTextPrimary }}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setFilter('issues')}
              className="px-2.5 py-1 text-xs rounded-md transition-opacity"
              style={{
                backgroundColor: filter === 'issues' ? fhBtnBg : 'transparent',
                color: filter === 'issues' ? fhTextPrimary : fhTextDim
              }}>
              Failing ({issues.length})
            </button>
            <button onClick={() => setFilter('all')}
              className="px-2.5 py-1 text-xs rounded-md transition-opacity"
              style={{
                backgroundColor: filter === 'all' ? fhBtnBg : 'transparent',
                color: filter === 'all' ? fhTextPrimary : fhTextDim
              }}>
              All ({results.length})
            </button>
          </div>

          {displayResults.length === 0 ? (
            <p className="text-sm" style={{ color: fhTextMuted }}>
              {filter === 'issues' ? 'All forums healthy — no consecutive failures detected.' : 'No results yet'}
            </p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {displayResults.map(r => {
                const failColor = r.consecutiveFailures >= 6
                  ? '#ef4444' // red
                  : r.consecutiveFailures >= 1
                    ? '#eab308' // yellow
                    : '#22c55e'; // green

                return (
                  <div key={r.url} className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ backgroundColor: r.consecutiveFailures >= 6 ? 'color-mix(in srgb, var(--ds-error) 8%, transparent)' : 'transparent' }}>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm" style={{ color: fhTextPrimary }}>{r.name}</span>
                      <span className="text-xs ml-2" style={{ color: fhTextDim }}>{safeHostname(r.url)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.status === 'ok' && r.consecutiveFailures === 0 && (
                        <span className="text-xs" style={{ color: fhTextMuted }}>{r.topicCount} topics</span>
                      )}
                      {r.consecutiveFailures > 0 && (
                        <span className="text-xs font-mono" style={{ color: failColor }}>
                          {r.consecutiveFailures}x fail
                        </span>
                      )}
                      {r.error && (
                        <span className="text-xs max-w-[160px] truncate" style={{ color: fhTextDim }} title={r.error}>{r.error}</span>
                      )}
                      {r.consecutiveFailures > 0 && (
                        <span className="text-[11px]" style={{ color: fhTextDim }} title={r.lastSuccess ? new Date(r.lastSuccess).toISOString() : 'never succeeded'}>
                          ok {formatTimeSince(r.lastSuccess)}
                        </span>
                      )}
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: failColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {results.length === 0 && !loading && (
        <p className="text-sm" style={{ color: fhTextMuted }}>
          No cache data yet. Click &quot;Refresh Cache&quot; above to fetch forum data.
        </p>
      )}
    </div>
  );
}
