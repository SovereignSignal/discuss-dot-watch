'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Database, Server, Users, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/hooks/useTheme';
import { useAdminToken } from '@/hooks/useAdminToken';
import { ForumAnalyticsSection } from '@/components/admin/ForumOperations';
import { ForumHealthSection } from '@/components/admin/ForumHealthSection';

interface SystemStats {
  database: {
    configured: boolean;
    connected: boolean;
    forums?: number;
    topics?: number;
    newTopicsLast24h?: number;
    error?: string;
  };
  redis: {
    connected: boolean;
    cachedForums?: number;
    lastRefresh?: string;
  };
  memoryCache?: {
    size: number;
    isRefreshing: boolean;
    lastRefreshStart?: number;
  };
}

interface User {
  id: number;
  privy_did: string;
  email: string;
  wallet_address: string | null;
  created_at: string;
  alert_count: number;
  bookmark_count: number;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl ${className}`} style={{ backgroundColor: 'var(--ds-bg-card)', border: '1px solid var(--ds-border)' }}>{children}</div>;
}

function Btn({ children, onClick, disabled, variant = 'default', className = '' }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger'; className?: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { backgroundColor: 'var(--ds-bg-elev)', border: '1px solid var(--ds-border)', color: 'var(--ds-fg)' },
    primary: { backgroundColor: 'var(--ds-fg)', color: 'var(--ds-bg-base)' },
    danger: { backgroundColor: 'transparent', border: '1px solid var(--ds-border)', color: 'var(--ds-fg-muted)' },
  };
  return <button onClick={onClick} disabled={disabled} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 ${className}`} style={styles[variant]}>{children}</button>;
}

function StatusBadge({ connected }: { connected: boolean }) {
  return <span className="ml-auto flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--ds-fg-muted)' }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: connected ? 'var(--ds-fg-muted)' : 'var(--ds-error)' }} />{connected ? 'Connected' : 'Down'}</span>;
}

export default function AdminPage() {
  const { hasToken, setToken, clearToken, getAuthHeaders: readAuthHeaders } = useAdminToken();
  const [secretInput, setSecretInput] = useState('');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { isDark } = useTheme();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    return readAuthHeaders();
  }, [readAuthHeaders]);

  const fetchData = useCallback(async () => {
    if (!hasToken) return;

    try {
      const authHeaders = await getAuthHeaders();
      const statsRes = await fetch('/api/admin', {
        headers: authHeaders,
      });
      if (statsRes.ok) {
        setStats(await statsRes.json());
      } else if (statsRes.status === 401 || statsRes.status === 403) {
        setError('Unauthorized - not an admin');
        return;
      }

      const usersRes = await fetch('/api/admin?action=users', {
        headers: authHeaders,
      });
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }

      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [hasToken, getAuthHeaders]);

  useEffect(() => {
    if (hasToken) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
      setError(null);
    }
  }, [hasToken, fetchData]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Theme tokens
  const bg = 'var(--ds-bg-base)';
  const cardBg = 'var(--ds-bg-card)';
  const cardBorder = 'var(--ds-border)';
  const textPrimary = 'var(--ds-fg)';
  const textSecondary = 'var(--ds-fg-muted)';
  const textMuted = 'var(--ds-fg-muted)';
  const textDim = 'var(--ds-fg-dim)';
  const btnBg = 'var(--ds-bg-elev)';
  const btnBorder = 'var(--ds-border)';

  if (!hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bg }}>
        <div className="rounded-xl p-8 max-w-md w-full" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
          <h1 className="text-xl font-semibold mb-2" style={{ color: textPrimary }}>Admin</h1>
          <p className="text-sm mb-6" style={{ color: textSecondary }}>
            Enter the platform admin secret (<code>ADMIN_SECRET</code> or <code>CRON_SECRET</code>).
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (secretInput.trim()) {
                setLoading(true);
                setToken(secretInput);
                setSecretInput('');
              }
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Admin secret"
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--ds-bg-elev)',
                border: `1px solid ${cardBorder}`,
                color: textPrimary,
              }}
            />
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--ds-fg)', color: 'var(--ds-bg-base)' }}
            >
              Continue
            </button>
          </form>
          <Link href="/app" className="inline-flex items-center gap-2 mt-6 text-sm transition-colors" style={{ color: textMuted }}>
            <ArrowLeft className="w-4 h-4" />
            Back to app
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: textMuted }} />
      </div>
    );
  }

  if (error === 'Unauthorized - not an admin') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
          <h1 className="text-xl font-semibold mb-4" style={{ color: textPrimary }}>Access Denied</h1>
          <p style={{ color: textSecondary }}>{error}</p>
          <button
            onClick={clearToken}
            className="inline-flex items-center gap-2 mt-6 transition-colors"
            style={{ color: textMuted }}
          >
            Try a different secret
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg, color: textPrimary }}>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/app" className="p-2 rounded-lg transition-colors" style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}` }}>
              <ArrowLeft className="w-4 h-4" style={{ color: textSecondary }} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2" style={{ color: textPrimary }}>
                <span>👁️‍🗨️</span> Admin
              </h1>
              <p className="text-xs mt-0.5" style={{ color: textDim }}>
                {lastRefresh && `Updated ${lastRefresh.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn onClick={fetchData} disabled={false}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Btn>
            <Btn onClick={clearToken}>Sign out</Btn>
          </div>
        </div>

        {error && error !== 'Unauthorized - not an admin' && (
          <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${cardBorder}`, color: textSecondary }}>
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Database className="w-4 h-4" style={{ color: textMuted }} />
              <span className="text-sm font-medium" style={{ color: textPrimary }}>Database</span>
              <StatusBadge connected={!!stats?.database?.connected} />
            </div>
            {stats?.database?.connected ? (
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-sm" style={{ color: textMuted }}>Forums</span><span className="font-mono text-sm" style={{ color: textPrimary }}>{stats.database.forums}</span></div>
                <div className="flex justify-between"><span className="text-sm" style={{ color: textMuted }}>Topics</span><span className="font-mono text-sm" style={{ color: textPrimary }}>{stats.database.topics?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-sm" style={{ color: textMuted }}>New (24h)</span><span className="font-mono text-sm" style={{ color: textPrimary }}>+{stats.database.newTopicsLast24h?.toLocaleString()}</span></div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: textMuted }}>{stats?.database?.error}</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Server className="w-4 h-4" style={{ color: textMuted }} />
              <span className="text-sm font-medium" style={{ color: textPrimary }}>Redis</span>
              <StatusBadge connected={!!stats?.redis?.connected} />
            </div>
            {stats?.redis?.connected && (
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-sm" style={{ color: textMuted }}>Cached</span><span className="font-mono text-sm" style={{ color: textPrimary }}>{stats.redis.cachedForums}</span></div>
                <div className="flex justify-between"><span className="text-sm" style={{ color: textMuted }}>Refreshed</span><span className="text-sm" style={{ color: textSecondary }}>{stats.redis.lastRefresh ? new Date(stats.redis.lastRefresh).toLocaleTimeString() : '—'}</span></div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <RefreshCw className={`w-4 h-4 ${stats?.memoryCache?.isRefreshing ? 'animate-spin' : ''}`} style={{ color: textMuted }} />
              <span className="text-sm font-medium" style={{ color: textPrimary }}>Memory</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm" style={{ color: textMuted }}>Cached</span><span className="font-mono text-sm" style={{ color: textPrimary }}>{stats?.memoryCache?.size || 0}</span></div>
              <div className="flex justify-between"><span className="text-sm" style={{ color: textMuted }}>Status</span><span className="text-sm" style={{ color: textSecondary }}>{stats?.memoryCache?.isRefreshing ? 'Refreshing…' : 'Idle'}</span></div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="p-5">
          <h2 className="text-sm font-medium mb-3" style={{ color: textPrimary }}>Actions</h2>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => handleAction('refresh-cache')} disabled={actionLoading !== null} variant="primary">
              {actionLoading === 'refresh-cache' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh Cache
            </Btn>
          </div>
        </Card>

        {/* Forum Analytics */}
        <ForumAnalyticsSection getAuthHeaders={getAuthHeaders} isDark={isDark} />

        {/* Forum Health */}
        <ForumHealthSection getAuthHeaders={getAuthHeaders} isDark={isDark} />

        {/* Users */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" style={{ color: textMuted }} />
              <span className="text-sm font-medium" style={{ color: textPrimary }}>Users</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: btnBg, color: textMuted }}>{users.length}</span>
            </div>
          </div>

          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <th className="pb-2 pr-4 text-left text-xs font-medium" style={{ color: textDim }}>Email</th>
                    <th className="pb-2 pr-4 text-left text-xs font-medium" style={{ color: textDim }}>Alerts</th>
                    <th className="pb-2 pr-4 text-left text-xs font-medium" style={{ color: textDim }}>Bookmarks</th>
                    <th className="pb-2 text-left text-xs font-medium" style={{ color: textDim }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                      <td className="py-2.5 pr-4" style={{ color: textPrimary }}>
                        {u.email || (u.wallet_address
                          ? <span className="font-mono text-xs" title={u.wallet_address}>{u.wallet_address.slice(0, 6)}...{u.wallet_address.slice(-4)} <span style={{ color: textDim }}>(wallet)</span></span>
                          : <span className="font-mono text-xs" style={{ color: textDim }} title={u.privy_did}>Anonymous ({u.privy_did.slice(-6)})</span>)}
                      </td>
                      <td className="py-2.5 pr-4 font-mono" style={{ color: textSecondary }}>{u.alert_count}</td>
                      <td className="py-2.5 pr-4 font-mono" style={{ color: textSecondary }}>{u.bookmark_count}</td>
                      <td className="py-2.5" style={{ color: textMuted }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm" style={{ color: textMuted }}>No stored user rows. The reader app is public and does not create accounts.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Forum Analytics Management Section ---
