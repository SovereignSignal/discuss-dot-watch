'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { RefreshCw, Database, Server, Users, Play, Pause, RotateCcw, Loader2, ArrowLeft, Search, Plus } from 'lucide-react';
import Link from 'next/link';
import { FORUM_CATEGORIES, ForumPreset, getTotalForumCount } from '@/lib/forumPresets';

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

interface BackfillJob {
  id: number;
  forum_id: number;
  forum_name: string;
  forum_url: string;
  status: string;
  current_page: number;
  topics_fetched: number;
  total_pages: number | null;
  last_run_at: string | null;
  error: string | null;
}

interface BackfillStatus {
  pending: number;
  running: number;
  complete: number;
  failed: number;
  paused: number;
  jobs: BackfillJob[];
}

interface User {
  id: number;
  privy_did: string;
  email: string;
  created_at: string;
  alert_count: number;
  bookmark_count: number;
}

export default function AdminPage() {
  const { user, authenticated, ready } = usePrivy();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isDark, setIsDark] = useState(true);

  // Sync theme with rest of app
  useEffect(() => {
    const saved = localStorage.getItem('gov-watch-theme');
    setIsDark(saved !== 'light');
    const handler = () => {
      const t = localStorage.getItem('gov-watch-theme');
      setIsDark(t !== 'light');
    };
    window.addEventListener('themechange', handler);
    window.addEventListener('storage', handler);
    return () => { window.removeEventListener('themechange', handler); window.removeEventListener('storage', handler); };
  }, []);

  const adminEmail = user?.email?.address || '';

  const fetchData = useCallback(async () => {
    if (!adminEmail) return;
    
    try {
      const statsRes = await fetch('/api/admin', {
        headers: { 'x-admin-email': adminEmail }
      });
      if (statsRes.ok) {
        setStats(await statsRes.json());
      } else if (statsRes.status === 401) {
        setError('Unauthorized - not an admin');
        return;
      }

      const backfillRes = await fetch('/api/backfill', {
        headers: { 'x-admin-email': adminEmail }
      });
      if (backfillRes.ok) {
        setBackfillStatus(await backfillRes.json());
      }

      const usersRes = await fetch('/api/admin?action=users', {
        headers: { 'x-admin-email': adminEmail }
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
  }, [adminEmail]);

  useEffect(() => {
    if (ready && authenticated && adminEmail) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    } else if (ready && !authenticated) {
      setLoading(false);
      setError('Please log in to access admin panel');
    }
  }, [ready, authenticated, adminEmail, fetchData]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
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

  const handleBackfillAction = async (action: string, jobId?: number) => {
    setActionLoading(`backfill-${action}-${jobId || 'all'}`);
    try {
      const res = await fetch('/api/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
        },
        body: JSON.stringify({ action, jobId }),
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
  const bg = isDark ? '#000000' : '#f5f5f5';
  const cardBg = isDark ? '#18181b' : '#ffffff';
  const cardBorder = isDark ? '#27272a' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#ffffff' : '#09090b';
  const textSecondary = isDark ? '#e5e5e5' : '#3f3f46';
  const textMuted = isDark ? '#a3a3a3' : '#52525b';
  const textDim = isDark ? '#52525b' : '#a1a1aa';
  const btnBg = isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)';
  const btnBorder = isDark ? '#2a2a2a' : 'rgba(0,0,0,0.1)';
  const btnHover = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const inputBg = isDark ? '#18181b' : 'rgba(0,0,0,0.03)';
  const statusOk = isDark ? '#e5e5e5' : '#52525b';
  const statusWarn = isDark ? '#e5e5e5' : '#71717a';

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: textMuted }} />
      </div>
    );
  }

  if (error === 'Unauthorized - not an admin' || error === 'Please log in to access admin panel') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="rounded-xl p-8 max-w-md text-center" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
          <h1 className="text-xl font-semibold mb-4" style={{ color: textPrimary }}>Access Denied</h1>
          <p style={{ color: textSecondary }}>{error}</p>
          <Link href="/" className="inline-flex items-center gap-2 mt-6 transition-colors" style={{ color: textMuted }}>
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-xl ${className}`} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
      {children}
    </div>
  );

  const Btn = ({ children, onClick, disabled, variant = 'default', className = '' }: {
    children: React.ReactNode; onClick: () => void; disabled?: boolean;
    variant?: 'default' | 'primary' | 'danger'; className?: string;
  }) => {
    const styles: Record<string, React.CSSProperties> = {
      default: { backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary },
      primary: { backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' },
      danger: { backgroundColor: 'transparent', border: `1px solid ${btnBorder}`, color: textMuted },
    };
    return (
      <button onClick={onClick} disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 ${className}`}
        style={styles[variant]}>
        {children}
      </button>
    );
  };

  const StatusBadge = ({ connected }: { connected: boolean }) => (
    <span className="ml-auto flex items-center gap-1.5 text-xs font-medium" style={{ color: textMuted }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: connected ? (isDark ? '#e5e5e5' : '#52525b') : '#ef4444' }} />
      {connected ? 'Connected' : 'Down'}
    </span>
  );

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
          <Btn onClick={fetchData} disabled={false}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Btn>
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
            <Btn onClick={() => handleAction('init-schema')} disabled={actionLoading !== null}>
              {actionLoading === 'init-schema' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              Init Schema
            </Btn>
            <Btn onClick={() => handleAction('refresh-cache')} disabled={actionLoading !== null} variant="primary">
              {actionLoading === 'refresh-cache' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh Cache
            </Btn>
            <Btn onClick={() => handleAction('clear-redis-cache')} disabled={actionLoading !== null} variant="danger">
              {actionLoading === 'clear-redis-cache' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Clear Redis
            </Btn>
          </div>
        </Card>

        {/* Forum Health */}
        <ForumHealthSection adminEmail={adminEmail} isDark={isDark} />

        {/* Backfill Status */}
        <BackfillSection
          backfillStatus={backfillStatus}
          actionLoading={actionLoading}
          onAction={handleBackfillAction}
          onQueueForum={async (url: string) => {
            setActionLoading(`backfill-start-${url}`);
            try {
              await fetch('/api/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail },
                body: JSON.stringify({ action: 'start', forumUrl: url }),
              });
              await fetchData();
            } finally {
              setActionLoading(null);
            }
          }}
          adminEmail={adminEmail}
          isDark={isDark}
        />

        {/* Users */}
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <Users className="w-4 h-4" style={{ color: textMuted }} />
            <span className="text-sm font-medium" style={{ color: textPrimary }}>Users</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: btnBg, color: textMuted }}>{users.length}</span>
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
                      <td className="py-2.5 pr-4" style={{ color: textPrimary }}>{u.email || u.privy_did.slice(0, 20) + '…'}</td>
                      <td className="py-2.5 pr-4 font-mono" style={{ color: textSecondary }}>{u.alert_count}</td>
                      <td className="py-2.5 pr-4 font-mono" style={{ color: textSecondary }}>{u.bookmark_count}</td>
                      <td className="py-2.5" style={{ color: textMuted }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm" style={{ color: textMuted }}>No users yet — click Init Schema if tables haven&apos;t been created.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function BackfillSection({ backfillStatus, actionLoading, onAction, onQueueForum, adminEmail, isDark = true }: {
  backfillStatus: BackfillStatus | null;
  actionLoading: string | null;
  onAction: (action: string, jobId?: number) => void;
  onQueueForum: (url: string) => Promise<void>;
  adminEmail: string;
  isDark?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [showForumPicker, setShowForumPicker] = useState(false);

  // All presets flattened
  const allForums = useMemo(() => {
    const forums: (ForumPreset & { categoryName: string })[] = [];
    FORUM_CATEGORIES.forEach(cat => {
      cat.forums.forEach(f => forums.push({ ...f, categoryName: cat.name }));
    });
    return forums;
  }, []);

  // Which URLs already have backfill jobs
  const queuedUrls = useMemo(() => {
    const set = new Set<string>();
    backfillStatus?.jobs?.forEach(j => set.add(j.forum_url.replace(/\/$/, '')));
    return set;
  }, [backfillStatus]);

  const filteredForums = useMemo(() => {
    if (!search.trim()) return allForums;
    const q = search.toLowerCase();
    return allForums.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.url.toLowerCase().includes(q) ||
      f.categoryName.toLowerCase().includes(q) ||
      (f.token && f.token.toLowerCase().includes(q))
    );
  }, [allForums, search]);

  const cardBg = isDark ? '#18181b' : '#ffffff';
  const cardBorder = isDark ? '#27272a' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#ffffff' : '#09090b';
  const textSecondary = isDark ? '#e5e5e5' : '#3f3f46';
  const textMuted = isDark ? '#a3a3a3' : '#52525b';
  const textDim = isDark ? '#52525b' : '#a1a1aa';
  const btnBg = isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)';
  const btnBorder = isDark ? '#2a2a2a' : 'rgba(0,0,0,0.1)';
  const inputBg = isDark ? '#18181b' : 'rgba(0,0,0,0.03)';

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium" style={{ color: textPrimary }}>Historical Backfill</h2>
        <div className="flex items-center gap-4 text-sm" style={{ color: textMuted }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: textSecondary }} />
            {backfillStatus?.complete || 0} complete
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: textSecondary }} />
            {backfillStatus?.running || 0} running
          </span>
          <span className="flex items-center gap-1.5" style={{ color: textDim }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: textDim }} />
            {backfillStatus?.pending || 0} pending
          </span>
          {(backfillStatus?.failed || 0) > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
              {backfillStatus?.failed} failed
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setShowForumPicker(!showForumPicker)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity"
          style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
          <Plus className="w-3 h-3" />
          {showForumPicker ? 'Hide' : 'Queue Forums'}
        </button>
        <button onClick={() => onAction('init-all')} disabled={actionLoading !== null}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
          style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
          Queue All
        </button>
        <button onClick={() => onAction('run-cycle')} disabled={actionLoading !== null}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
          style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
          <Play className="w-3 h-3" />
          Run Cycle
        </button>
      </div>

      {/* Forum Picker */}
      {showForumPicker && (
        <div className="mb-6 rounded-xl overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
          <div className="p-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search forums..."
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: inputBg, color: textPrimary }}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredForums.map(forum => {
              const normalizedUrl = forum.url.replace(/\/$/, '');
              const isQueued = queuedUrls.has(normalizedUrl);
              const job = backfillStatus?.jobs?.find(j => j.forum_url.replace(/\/$/, '') === normalizedUrl);
              const isLoading = actionLoading === `backfill-start-${forum.url}`;
              return (
                <div key={forum.url} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: textPrimary }}>{forum.name}</span>
                      {forum.token && <span className="text-xs font-mono" style={{ color: textMuted }}>${forum.token}</span>}
                      <span className="text-[11px]" style={{ color: textDim }}>{forum.categoryName}</span>
                    </div>
                    <p className="text-xs truncate" style={{ color: textDim }}>{forum.url}</p>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    {isQueued && job ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ color: textSecondary }}>
                        {job.status} {job.topics_fetched > 0 ? `(${job.topics_fetched.toLocaleString()})` : ''}
                      </span>
                    ) : (
                      <button onClick={() => onQueueForum(forum.url)} disabled={isLoading || actionLoading !== null}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Queue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2 text-xs" style={{ borderTop: `1px solid ${cardBorder}`, color: textDim }}>
            {filteredForums.length} forums · {queuedUrls.size} queued
          </div>
        </div>
      )}

      {/* Jobs Table */}
      {backfillStatus?.jobs && backfillStatus.jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <th className="pb-3 pr-4 text-left text-xs font-medium" style={{ color: textDim }}>Forum</th>
                <th className="pb-3 pr-4 text-left text-xs font-medium" style={{ color: textDim }}>Status</th>
                <th className="pb-3 pr-4 text-left text-xs font-medium" style={{ color: textDim }}>Progress</th>
                <th className="pb-3 pr-4 text-left text-xs font-medium" style={{ color: textDim }}>Topics</th>
                <th className="pb-3 text-left text-xs font-medium" style={{ color: textDim }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backfillStatus.jobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
                  <td className="py-3 pr-4">
                    <a href={job.forum_url} target="_blank" rel="noopener noreferrer"
                      className="hover:underline" style={{ color: textPrimary }}>
                      {job.forum_name}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs font-medium" style={{ color: textMuted }}>{job.status}</span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-sm" style={{ color: textMuted }}>
                    Page {job.current_page}{job.total_pages ? ` / ${job.total_pages}` : ''}
                  </td>
                  <td className="py-3 pr-4 font-mono text-sm" style={{ color: textPrimary }}>{job.topics_fetched.toLocaleString()}</td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      {job.status === 'running' && (
                        <button onClick={() => onAction('pause', job.id)}
                          className="p-1.5 rounded-lg transition-opacity hover:opacity-70" 
                          style={{ backgroundColor: btnBg, color: textMuted }} title="Pause">
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {job.status === 'paused' && (
                        <button onClick={() => onAction('resume', job.id)}
                          className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                          style={{ backgroundColor: btnBg, color: textMuted }} title="Resume">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {job.status === 'failed' && (
                        <button onClick={() => onAction('retry', job.id)}
                          className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
                          style={{ backgroundColor: btnBg, color: textMuted }} title="Retry">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ForumHealth {
  name: string;
  url: string;
  status: 'ok' | 'redirect' | 'error' | 'pending' | 'testing';
  statusCode?: number;
  redirectUrl?: string;
  error?: string;
}

function ForumHealthSection({ adminEmail, isDark = true }: { adminEmail: string; isDark?: boolean }) {
  const [results, setResults] = useState<ForumHealth[]>([]);
  const [testing, setTesting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'issues'>('issues');

  const fhCardBg = isDark ? '#18181b' : '#ffffff';
  const fhCardBorder = isDark ? '#27272a' : 'rgba(0,0,0,0.08)';
  const fhTextPrimary = isDark ? '#ffffff' : '#09090b';
  const fhTextMuted = isDark ? '#a3a3a3' : '#52525b';
  const fhTextDim = isDark ? '#52525b' : '#a1a1aa';
  const fhBtnBg = isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)';
  const fhBtnBorder = isDark ? '#2a2a2a' : 'rgba(0,0,0,0.1)';

  const allForums = useMemo(() => {
    const forums: { name: string; url: string }[] = [];
    FORUM_CATEGORIES.forEach(cat => {
      cat.forums.forEach(f => forums.push({ name: f.name, url: f.url }));
    });
    return forums;
  }, []);

  const testForums = async () => {
    setTesting(true);
    setResults(allForums.map(f => ({ ...f, status: 'pending' as const })));

    // Test in small batches with delays to avoid rate limiting
    const batchSize = 3;
    const delayMs = 2000; // 2 second delay between batches
    
    for (let i = 0; i < allForums.length; i += batchSize) {
      const batch = allForums.slice(i, i + batchSize);
      await Promise.all(batch.map(async (forum) => {
        setResults(prev => prev.map(r => r.url === forum.url ? { ...r, status: 'testing' } : r));
        try {
          const res = await fetch(`/api/validate-discourse?url=${encodeURIComponent(forum.url)}`);
          const data = await res.json();
          setResults(prev => prev.map(r => {
            if (r.url !== forum.url) return r;
            if (data.valid) return { ...r, status: 'ok' };
            if (data.error?.includes('redirect')) return { ...r, status: 'redirect', error: data.error, redirectUrl: data.redirectUrl };
            if (data.error?.includes('Rate limit')) return { ...r, status: 'error', error: 'Rate limited' };
            return { ...r, status: 'error', error: data.error || 'Failed' };
          }));
        } catch (err) {
          setResults(prev => prev.map(r =>
            r.url === forum.url ? { ...r, status: 'error', error: 'Network error' } : r
          ));
        }
      }));
      
      // Delay between batches to avoid rate limiting
      if (i + batchSize < allForums.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    setTesting(false);
  };

  const issues = results.filter(r => r.status === 'error' || r.status === 'redirect');
  const displayResults = filter === 'issues' ? issues : results.filter(r => r.status !== 'pending');

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: fhCardBg, border: `1px solid ${fhCardBorder}` }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium" style={{ color: fhTextPrimary }}>Forum Health</h2>
        <div className="flex items-center gap-3">
          {results.length > 0 && (
            <div className="flex items-center gap-3 text-sm" style={{ color: fhTextMuted }}>
              <span>{results.filter(r => r.status === 'ok').length} ok</span>
              {issues.length > 0 && <span style={{ color: '#f59e0b' }}>{issues.length} issues</span>}
              {results.filter(r => r.status === 'pending' || r.status === 'testing').length > 0 && (
                <span style={{ color: fhTextDim }}>{results.filter(r => r.status === 'pending' || r.status === 'testing').length} remaining</span>
              )}
            </div>
          )}
          <button onClick={testForums} disabled={testing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
            style={{ backgroundColor: fhBtnBg, border: `1px solid ${fhBtnBorder}`, color: fhTextPrimary }}>
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {testing ? 'Testing...' : 'Test All Forums'}
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
              Issues Only ({issues.length})
            </button>
            <button onClick={() => setFilter('all')}
              className="px-2.5 py-1 text-xs rounded-md transition-opacity"
              style={{ 
                backgroundColor: filter === 'all' ? fhBtnBg : 'transparent', 
                color: filter === 'all' ? fhTextPrimary : fhTextDim 
              }}>
              All Tested
            </button>
          </div>

          {displayResults.length === 0 ? (
            <p className="text-sm" style={{ color: fhTextMuted }}>{filter === 'issues' ? 'No issues found' : 'No results yet'}</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {displayResults.map(r => (
                <div key={r.url} className="flex items-center justify-between px-3 py-2 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm" style={{ color: fhTextPrimary }}>{r.name}</span>
                    <span className="text-xs ml-2" style={{ color: fhTextDim }}>{r.url}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ 
                    color: r.status === 'ok' ? fhTextMuted : 
                           r.status === 'error' ? '#ef4444' : 
                           r.status === 'redirect' ? '#f59e0b' : fhTextMuted
                  }}>
                    {r.status === 'testing' ? 'testing...' : r.status}
                    {r.error && r.status !== 'ok' ? `: ${r.error.slice(0, 40)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {results.length === 0 && (
        <p className="text-sm" style={{ color: fhTextMuted }}>Click &quot;Test All Forums&quot; to check which forum URLs are still reachable.</p>
      )}
    </div>
  );
}
