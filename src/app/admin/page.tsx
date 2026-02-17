'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { RefreshCw, Database, Server, Users, Play, Pause, RotateCcw, Loader2, ArrowLeft, Search, Plus, Globe, Eye, ExternalLink, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
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
            <Btn onClick={() => handleAction('refresh-cache')} disabled={actionLoading !== null} variant="primary">
              {actionLoading === 'refresh-cache' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh Cache
            </Btn>
          </div>
        </Card>

        {/* Forum Analytics */}
        <ForumAnalyticsSection adminEmail={adminEmail} isDark={isDark} />

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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" style={{ color: textMuted }} />
              <span className="text-sm font-medium" style={{ color: textPrimary }}>Users</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: btnBg, color: textMuted }}>{users.length}</span>
            </div>
            <Btn onClick={() => handleAction('sync-privy-users')} disabled={actionLoading !== null}>
              {actionLoading === 'sync-privy-users' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync from Privy
            </Btn>
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
            <p className="text-sm" style={{ color: textMuted }}>No users yet — click &quot;Sync from Privy&quot; to import users.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Forum Analytics Management Section ---

interface TenantInfo {
  id: number;
  slug: string;
  name: string;
  forumUrl: string;
  apiUsername: string;
  capabilities: {
    canListUsers?: boolean;
    canViewUserStats?: boolean;
    canViewUserPosts?: boolean;
    canSearchPosts?: boolean;
  };
  isActive: boolean;
  lastRefreshAt: string | null;
  createdAt: string;
}

interface SyncJob {
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

function ForumAnalyticsSection({ adminEmail, isDark = true }: { adminEmail: string; isDark?: boolean }) {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formApiUsername, setFormApiUsername] = useState('system');
  const [formApiKey, setFormApiKey] = useState('');

  const cardBg = isDark ? '#18181b' : '#ffffff';
  const cardBorder = isDark ? '#27272a' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#ffffff' : '#09090b';
  const textSecondary = isDark ? '#e5e5e5' : '#3f3f46';
  const textMuted = isDark ? '#a3a3a3' : '#52525b';
  const textDim = isDark ? '#52525b' : '#a1a1aa';
  const btnBg = isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)';
  const btnBorder = isDark ? '#2a2a2a' : 'rgba(0,0,0,0.1)';
  const inputBg = isDark ? '#0a0a0a' : 'rgba(0,0,0,0.03)';

  const headers = useMemo(() => ({ 'x-admin-email': adminEmail }), [adminEmail]);
  const postHeaders = useMemo(() => ({ 'Content-Type': 'application/json', 'x-admin-email': adminEmail }), [adminEmail]);

  // Match a sync job to a tenant by normalizing URLs
  const getSyncJob = useCallback((forumUrl: string): SyncJob | undefined => {
    const normalized = forumUrl.replace(/\/$/, '').toLowerCase();
    return syncJobs.find(j => j.forum_url.replace(/\/$/, '').toLowerCase() === normalized);
  }, [syncJobs]);

  const fetchData = useCallback(async () => {
    try {
      const [tenantsRes, backfillRes] = await Promise.all([
        fetch('/api/delegates/admin', { headers }),
        fetch('/api/backfill', { headers }),
      ]);

      if (tenantsRes.ok) {
        const data = await tenantsRes.json();
        setTenants(data.tenants || []);
        setSchemaReady(true);
      } else if (tenantsRes.status === 500) {
        setSchemaReady(false);
      }

      if (backfillRes.ok) {
        const data = await backfillRes.json();
        setSyncJobs(data.jobs || []);
      }
    } catch {
      setSchemaReady(false);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (adminEmail) fetchData();
  }, [adminEmail, fetchData]);

  // Poll for sync progress when any tenant has a running/pending sync
  useEffect(() => {
    const hasActive = syncJobs.some(j => j.status === 'running' || j.status === 'pending');
    if (!hasActive || !adminEmail) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [syncJobs, adminEmail, fetchData]);

  const handleInitSchema = async () => {
    setActionLoading('init-schema');
    try {
      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ action: 'init-schema' }),
      });
      if (res.ok) {
        setSchemaReady(true);
        await fetchData();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to initialize schema');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formName || !formSlug || !formUrl || !formApiKey || !formApiUsername) {
      setFormError('All fields are required');
      return;
    }

    setActionLoading('create-tenant');
    try {
      const normalizedUrl = formUrl.replace(/\/$/, '');

      // 1. Create the analytics tenant
      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({
          action: 'create-tenant',
          name: formName,
          slug: formSlug,
          forumUrl: normalizedUrl,
          apiKey: formApiKey,
          apiUsername: formApiUsername,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create forum');
        return;
      }

      // 2. Auto-start forum sync (backfill)
      setFormSuccess(`Forum "${formName}" created. Starting historical sync...`);
      setActionLoading('initial-sync');

      try {
        await fetch('/api/backfill', {
          method: 'POST',
          headers: postHeaders,
          body: JSON.stringify({ action: 'start', forumUrl: normalizedUrl }),
        });
      } catch {
        // Backfill start is best-effort — forum may not be in presets
      }

      // 3. Also trigger contributor data pull
      try {
        await fetch(`/api/delegates/${formSlug}/refresh`, {
          method: 'POST',
          headers: postHeaders,
        });
      } catch {
        // Best-effort
      }

      setFormSuccess(`Forum "${formName}" created. Sync started — topics are being pulled in the background.`);

      // Reset form
      setFormName('');
      setFormSlug('');
      setFormUrl('');
      setFormApiUsername('system');
      setFormApiKey('');
      setShowAddForm(false);
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create forum');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async (slug: string) => {
    setActionLoading(`refresh-${slug}`);
    try {
      await fetch(`/api/delegates/${slug}/refresh`, {
        method: 'POST',
        headers: postHeaders,
      });
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartSync = async (forumUrl: string) => {
    setActionLoading(`sync-start-${forumUrl}`);
    try {
      await fetch('/api/backfill', {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ action: 'start', forumUrl }),
      });
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to start sync');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncAction = async (action: string, jobId: number) => {
    setActionLoading(`sync-${action}-${jobId}`);
    try {
      await fetch('/api/backfill', {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ action, jobId }),
      });
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sync action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunCycle = async () => {
    setActionLoading('run-cycle');
    try {
      await fetch('/api/backfill', {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ action: 'run-cycle' }),
      });
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to run sync cycle');
    } finally {
      setActionLoading(null);
    }
  };

  // Auto-generate slug from name
  const updateName = (name: string) => {
    setFormName(name);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setFormSlug(slug);
  };

  const capCount = (caps: TenantInfo['capabilities']) =>
    [caps.canListUsers, caps.canViewUserStats, caps.canViewUserPosts, caps.canSearchPosts].filter(Boolean).length;

  // Sync status helpers
  const getSyncStatusLabel = (job: SyncJob | undefined) => {
    if (!job) return { label: 'Sync Required', color: '#f59e0b', pulse: false };
    switch (job.status) {
      case 'complete': return { label: `Synced · ${job.topics_fetched.toLocaleString()} topics`, color: isDark ? '#e5e5e5' : '#52525b', pulse: false };
      case 'running': return { label: `Syncing · ${job.topics_fetched.toLocaleString()} topics · page ${job.current_page}${job.total_pages ? `/${job.total_pages}` : ''}`, color: isDark ? '#e5e5e5' : '#52525b', pulse: true };
      case 'pending': return { label: 'Sync queued', color: textMuted, pulse: true };
      case 'paused': return { label: `Paused · ${job.topics_fetched.toLocaleString()} topics`, color: '#f59e0b', pulse: false };
      case 'failed': return { label: `Sync failed`, color: '#ef4444', pulse: false };
      default: return { label: job.status, color: textMuted, pulse: false };
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl p-5" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4" style={{ color: textMuted }} />
          <span className="text-sm font-medium" style={{ color: textPrimary }}>Forum Analytics</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: textMuted }} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4" style={{ color: textMuted }} />
          <span className="text-sm font-medium" style={{ color: textPrimary }}>Forum Analytics</span>
          {tenants.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: btnBg, color: textMuted }}>
              {tenants.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!schemaReady && (
            <button onClick={handleInitSchema} disabled={actionLoading !== null}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
              style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
              {actionLoading === 'init-schema' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              Initialize Schema
            </button>
          )}
          {schemaReady && syncJobs.some(j => j.status === 'pending' || j.status === 'running') && (
            <button onClick={handleRunCycle} disabled={actionLoading !== null}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
              style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
              {actionLoading === 'run-cycle' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run Sync Cycle
            </button>
          )}
          {schemaReady && (
            <button onClick={() => { setShowAddForm(!showAddForm); setFormError(null); setFormSuccess(null); }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity"
              style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
              <Plus className="w-3.5 h-3.5" />
              {showAddForm ? 'Cancel' : 'Add Forum'}
            </button>
          )}
        </div>
      </div>

      {/* Status messages */}
      {formError && (
        <div className="flex items-center gap-2 rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {formError}
        </div>
      )}
      {formSuccess && (
        <div className="flex items-center gap-2 rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${cardBorder}`, color: textSecondary }}>
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          {formSuccess}
        </div>
      )}

      {/* Not initialized state */}
      {!schemaReady && (
        <p className="text-sm" style={{ color: textMuted }}>
          Database tables not initialized. Click &quot;Initialize Schema&quot; to set up forum analytics.
        </p>
      )}

      {/* Add Forum Form */}
      {showAddForm && schemaReady && (
        <form onSubmit={handleCreateTenant} className="mb-6 rounded-xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
          <h3 className="text-sm font-medium mb-1" style={{ color: textPrimary }}>Add New Forum</h3>
          <p className="text-xs mb-3" style={{ color: textDim }}>Adding a forum will automatically start syncing all historical topics and contributor data.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: textMuted }}>Forum Name</label>
              <input type="text" value={formName} onChange={e => updateName(e.target.value)}
                placeholder="e.g. My Community Forum"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: textMuted }}>URL Slug</label>
              <input type="text" value={formSlug} onChange={e => setFormSlug(e.target.value)}
                placeholder="e.g. my-community"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }} />
              {formSlug && (
                <p className="text-xs mt-1" style={{ color: textDim }}>Dashboard URL: /{formSlug}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: textMuted }}>Discourse Forum URL</label>
            <input type="url" value={formUrl} onChange={e => setFormUrl(e.target.value)}
              placeholder="e.g. https://forum.example.org"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: textMuted }}>API Username</label>
              <input type="text" value={formApiUsername} onChange={e => setFormApiUsername(e.target.value)}
                placeholder="system"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }} />
              <p className="text-xs mt-1" style={{ color: textDim }}>Usually &quot;system&quot; for admin-level API keys</p>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: textMuted }}>API Key</label>
              <input type="password" value={formApiKey} onChange={e => setFormApiKey(e.target.value)}
                placeholder="Discourse API key"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }} />
              <p className="text-xs mt-1" style={{ color: textDim }}>Encrypted at rest (AES-256-GCM)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button type="submit" disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
              {actionLoading === 'create-tenant' || actionLoading === 'initial-sync' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {actionLoading === 'initial-sync' ? 'Starting sync...' : actionLoading === 'create-tenant' ? 'Creating...' : 'Create & Start Sync'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textMuted }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tenants List */}
      {schemaReady && tenants.length === 0 && !showAddForm && (
        <p className="text-sm" style={{ color: textMuted }}>
          No forums configured yet. Click &quot;Add Forum&quot; to start tracking a Discourse forum.
        </p>
      )}

      {schemaReady && tenants.length > 0 && (
        <div className="space-y-2">
          {tenants.map(tenant => {
            const isExpanded = expandedTenant === tenant.slug;
            const isRefreshing = actionLoading === `refresh-${tenant.slug}`;
            const caps = capCount(tenant.capabilities);
            const syncJob = getSyncJob(tenant.forumUrl);
            const syncStatus = getSyncStatusLabel(syncJob);
            const isSyncing = syncJob && (syncJob.status === 'running' || syncJob.status === 'pending');
            return (
              <div key={tenant.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                {/* Tenant Row */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedTenant(isExpanded ? null : tenant.slug)}
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: textPrimary }}>{tenant.name}</span>
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: btnBg, color: textMuted }}>/{tenant.slug}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs truncate" style={{ color: textDim }}>{tenant.forumUrl}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ color: syncStatus.color, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${syncStatus.pulse ? 'animate-pulse' : ''}`} style={{ backgroundColor: syncStatus.color }} />
                        {syncStatus.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!syncJob && (
                      <button onClick={(e) => { e.stopPropagation(); handleStartSync(tenant.forumUrl); }}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}
                        title="Start syncing forum data">
                        {actionLoading === `sync-start-${tenant.forumUrl}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Start Sync
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleRefresh(tenant.slug); }}
                      disabled={actionLoading !== null}
                      className="p-1.5 rounded-lg transition-opacity disabled:opacity-40"
                      style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}` }}
                      title="Refresh contributor data">
                      {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: textMuted }} /> : <RefreshCw className="w-3.5 h-3.5" style={{ color: textMuted }} />}
                    </button>
                    <Link href={`/${tenant.slug}`} onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg transition-opacity"
                      style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}` }}
                      title="View dashboard">
                      <Eye className="w-3.5 h-3.5" style={{ color: textMuted }} />
                    </Link>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" style={{ color: textDim }} />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" style={{ color: textDim }} />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 py-3 space-y-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>

                    {/* Sync Status */}
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: textMuted }}>Forum Sync</p>
                      {syncJob ? (
                        <div className="rounded-lg p-3" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isSyncing ? 'animate-pulse' : ''}`} style={{ backgroundColor: syncStatus.color }} />
                              <span className="text-xs font-medium" style={{ color: textSecondary }}>{syncJob.status === 'complete' ? 'Complete' : syncJob.status === 'running' ? 'Running' : syncJob.status === 'pending' ? 'Queued' : syncJob.status === 'paused' ? 'Paused' : syncJob.status === 'failed' ? 'Failed' : syncJob.status}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {syncJob.status === 'paused' && (
                                <button onClick={() => handleSyncAction('resume', syncJob.id)}
                                  disabled={actionLoading !== null}
                                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-opacity disabled:opacity-40"
                                  style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
                                  <Play className="w-3 h-3" /> Resume
                                </button>
                              )}
                              {(syncJob.status === 'running' || syncJob.status === 'pending') && (
                                <button onClick={() => handleSyncAction('pause', syncJob.id)}
                                  disabled={actionLoading !== null}
                                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-opacity disabled:opacity-40"
                                  style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textMuted }}>
                                  <Pause className="w-3 h-3" /> Pause
                                </button>
                              )}
                              {syncJob.status === 'failed' && (
                                <button onClick={() => handleSyncAction('retry', syncJob.id)}
                                  disabled={actionLoading !== null}
                                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-opacity disabled:opacity-40"
                                  style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
                                  <RotateCcw className="w-3 h-3" /> Retry
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <span style={{ color: textDim }}>Topics</span>
                              <p className="font-mono mt-0.5" style={{ color: textPrimary }}>{syncJob.topics_fetched.toLocaleString()}</p>
                            </div>
                            <div>
                              <span style={{ color: textDim }}>Progress</span>
                              <p className="font-mono mt-0.5" style={{ color: textSecondary }}>
                                Page {syncJob.current_page}{syncJob.total_pages ? ` / ${syncJob.total_pages}` : ''}
                              </p>
                            </div>
                            <div>
                              <span style={{ color: textDim }}>Last Run</span>
                              <p className="mt-0.5" style={{ color: textSecondary }}>
                                {syncJob.last_run_at ? new Date(syncJob.last_run_at).toLocaleString() : '—'}
                              </p>
                            </div>
                          </div>
                          {syncJob.error && (
                            <p className="text-xs mt-2 flex items-center gap-1" style={{ color: '#ef4444' }}>
                              <AlertTriangle className="w-3 h-3" /> {syncJob.error}
                            </p>
                          )}
                          {/* Progress bar */}
                          {syncJob.total_pages && syncJob.total_pages > 0 && syncJob.status !== 'complete' && (
                            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{
                                width: `${Math.min(100, (syncJob.current_page / syncJob.total_pages) * 100)}%`,
                                backgroundColor: isDark ? '#e5e5e5' : '#52525b',
                              }} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                            <span className="text-xs" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
                              Forum data has not been synced yet. Start a sync to pull in historical topics.
                            </span>
                          </div>
                          <button onClick={() => handleStartSync(tenant.forumUrl)}
                            disabled={actionLoading !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity disabled:opacity-40"
                            style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
                            {actionLoading === `sync-start-${tenant.forumUrl}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Start Sync
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Capabilities */}
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: textMuted }}>API Capabilities ({caps}/4)</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ['canListUsers', 'List Users'],
                          ['canViewUserStats', 'User Stats'],
                          ['canViewUserPosts', 'User Posts'],
                          ['canSearchPosts', 'Search Posts'],
                        ] as const).map(([key, label]) => (
                          <span key={key} className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor: tenant.capabilities[key] ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : 'transparent',
                              border: `1px solid ${tenant.capabilities[key] ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)') : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}`,
                              color: tenant.capabilities[key] ? textSecondary : textDim,
                            }}>
                            {tenant.capabilities[key] ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 inline-block text-center">—</span>}
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span style={{ color: textDim }}>API User</span>
                        <p className="font-mono mt-0.5" style={{ color: textSecondary }}>{tenant.apiUsername}</p>
                      </div>
                      <div>
                        <span style={{ color: textDim }}>Created</span>
                        <p className="mt-0.5" style={{ color: textSecondary }}>{new Date(tenant.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span style={{ color: textDim }}>Last Refresh</span>
                        <p className="mt-0.5" style={{ color: textSecondary }}>
                          {tenant.lastRefreshAt ? new Date(tenant.lastRefreshAt).toLocaleString() : 'Never'}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: textDim }}>Status</span>
                        <p className="mt-0.5" style={{ color: tenant.isActive ? textSecondary : '#ef4444' }}>
                          {tenant.isActive ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <a href={tenant.forumUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity"
                        style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textMuted }}>
                        <ExternalLink className="w-3 h-3" /> Visit Forum
                      </a>
                      <Link href={`/${tenant.slug}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity"
                        style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textMuted }}>
                        <Eye className="w-3 h-3" /> View Dashboard
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  status: 'ok' | 'error' | 'not_cached';
  topicCount: number;
  lastFetched: number | null;
  error?: string;
}

function ForumHealthSection({ adminEmail, isDark = true }: { adminEmail: string; isDark?: boolean }) {
  const [results, setResults] = useState<ForumHealth[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'issues'>('issues');

  const fhCardBg = isDark ? '#18181b' : '#ffffff';
  const fhCardBorder = isDark ? '#27272a' : 'rgba(0,0,0,0.08)';
  const fhTextPrimary = isDark ? '#ffffff' : '#09090b';
  const fhTextMuted = isDark ? '#a3a3a3' : '#52525b';
  const fhTextDim = isDark ? '#52525b' : '#a1a1aa';
  const fhBtnBg = isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)';
  const fhBtnBorder = isDark ? '#2a2a2a' : 'rgba(0,0,0,0.1)';

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin?action=forum-health', {
        headers: { 'x-admin-email': adminEmail },
      });
      const data = await res.json();
      setResults(data.forums || []);
    } catch {
      console.error('Failed to fetch forum health');
    } finally {
      setLoading(false);
    }
  }, [adminEmail]);

  // Fetch on mount
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const issues = results.filter(r => r.status === 'error');
  const notCached = results.filter(r => r.status === 'not_cached');
  const ok = results.filter(r => r.status === 'ok');
  const displayResults = filter === 'issues' ? issues : results;

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: fhCardBg, border: `1px solid ${fhCardBorder}` }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium" style={{ color: fhTextPrimary }}>Forum Health</h2>
          <p className="text-xs mt-0.5" style={{ color: fhTextDim }}>Based on last cache refresh</p>
        </div>
        <div className="flex items-center gap-3">
          {results.length > 0 && (
            <div className="flex items-center gap-3 text-sm" style={{ color: fhTextMuted }}>
              <span style={{ color: '#22c55e' }}>{ok.length} ok</span>
              {issues.length > 0 && <span style={{ color: '#ef4444' }}>{issues.length} failed</span>}
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
              Failed Only ({issues.length})
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
              {filter === 'issues' ? 'No failed forums — all cached forums loaded successfully.' : 'No results yet'}
            </p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {displayResults.map(r => (
                <div key={r.url} className="flex items-center justify-between px-3 py-2 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm" style={{ color: fhTextPrimary }}>{r.name}</span>
                    <span className="text-xs ml-2" style={{ color: fhTextDim }}>{new URL(r.url).hostname}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.status === 'ok' && (
                      <span className="text-xs" style={{ color: fhTextMuted }}>{r.topicCount} topics</span>
                    )}
                    <span className="text-[11px] font-medium" style={{ 
                      color: r.status === 'ok' ? '#22c55e' : 
                             r.status === 'error' ? '#ef4444' : fhTextDim
                    }}>
                      {r.status === 'not_cached' ? 'not cached' : r.status}
                    </span>
                  </div>
                </div>
              ))}
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
