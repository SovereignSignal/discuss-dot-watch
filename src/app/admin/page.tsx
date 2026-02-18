'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { RefreshCw, Database, Server, Users, Play, Pause, RotateCcw, Loader2, ArrowLeft, Search, Plus, Globe, Eye, EyeOff, ExternalLink, Check, AlertTriangle, ChevronDown, ChevronUp, ArrowRight, Upload, X, UserPlus, Trash2, Pencil, Save } from 'lucide-react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FORUM_CATEGORIES, ForumPreset } from '@/lib/forumPresets';
import { DELEGATE_ROLES } from '@/types/delegates';
import type { UserSearchResult } from '@/types/delegates';

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

export default function AdminPage() {
  const { user, authenticated, ready } = usePrivy();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isDark, setIsDark] = useState(true);

  // Sync theme with rest of app
  useEffect(() => {
    const saved = localStorage.getItem('discuss-watch-theme');
    setIsDark(saved !== 'light');
    const handler = () => {
      const t = localStorage.getItem('discuss-watch-theme');
      setIsDark(t !== 'light');
    };
    window.addEventListener('themechange', handler);
    window.addEventListener('storage', handler);
    return () => { window.removeEventListener('themechange', handler); window.removeEventListener('storage', handler); };
  }, []);

  const { getAccessToken } = usePrivy();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const token = await getAccessToken();
      if (!token) return {};
      return { 'Authorization': `Bearer ${token}` };
    } catch {
      return {};
    }
  }, [getAccessToken]);

  const fetchData = useCallback(async () => {
    if (!authenticated) return;

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
  }, [authenticated, getAuthHeaders]);

  useEffect(() => {
    if (ready && authenticated) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    } else if (ready && !authenticated) {
      setLoading(false);
      setError('Please log in to access admin panel');
    }
  }, [ready, authenticated, fetchData]);

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
  const bg = isDark ? '#000000' : '#f5f5f5';
  const cardBg = isDark ? '#18181b' : '#ffffff';
  const cardBorder = isDark ? '#27272a' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#ffffff' : '#09090b';
  const textSecondary = isDark ? '#e5e5e5' : '#3f3f46';
  const textMuted = isDark ? '#a3a3a3' : '#52525b';
  const textDim = isDark ? '#52525b' : '#a1a1aa';
  const btnBg = isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)';
  const btnBorder = isDark ? '#2a2a2a' : 'rgba(0,0,0,0.1)';

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
                      <td className="py-2.5 pr-4" style={{ color: textPrimary }}>
                        {u.email || (u.wallet_address
                          ? <span className="font-mono text-xs" title={u.wallet_address}>{u.wallet_address.slice(0, 6)}...{u.wallet_address.slice(-4)} <span style={{ color: textDim }}>(wallet)</span></span>
                          : <span style={{ color: textDim }}>{u.privy_did.slice(0, 20)}…</span>)}
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

interface DelegateInfo {
  id: number;
  username: string;
  displayName: string;
  walletAddress: string | null;
  programs: string[];
  role?: string;
  isActive: boolean;
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

function ForumAnalyticsSection({ getAuthHeaders, isDark = true }: { getAuthHeaders: () => Promise<Record<string, string>>; isDark?: boolean }) {
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [presetSearch, setPresetSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Delegate management state
  const [delegatesByTenant, setDelegatesByTenant] = useState<Record<string, DelegateInfo[]>>({});
  const [showDelegateUpload, setShowDelegateUpload] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [uploadResult, setUploadResult] = useState<{ created: number; errors: { username: string; error: string }[] } | null>(null);
  const [addUsername, setAddUsername] = useState('');
  const [addRole, setAddRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchUser, setSelectedSearchUser] = useState<UserSearchResult | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ slug: string; username: string; displayName: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formApiUsername, setFormApiUsername] = useState('system');
  const [formApiKey, setFormApiKey] = useState('');

  // Edit tenant settings state
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [editApiKey, setEditApiKey] = useState('');
  const [editApiUsername, setEditApiUsername] = useState('');
  const [editShowKey, setEditShowKey] = useState(false);

  const cardBg = isDark ? '#18181b' : '#ffffff';
  const cardBorder = isDark ? '#27272a' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#ffffff' : '#09090b';
  const textSecondary = isDark ? '#e5e5e5' : '#3f3f46';
  const textMuted = isDark ? '#a3a3a3' : '#52525b';
  const textDim = isDark ? '#52525b' : '#a1a1aa';
  const btnBg = isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)';
  const btnBorder = isDark ? '#2a2a2a' : 'rgba(0,0,0,0.1)';
  const inputBg = isDark ? '#0a0a0a' : 'rgba(0,0,0,0.03)';

  // Auth headers are fetched async before each request via getAuthHeaders
  // Helper for POST requests
  const getPostHeaders = useCallback(async () => {
    const auth = await getAuthHeaders();
    return { 'Content-Type': 'application/json', ...auth };
  }, [getAuthHeaders]);

  // All forum presets flattened
  const allPresets = useMemo(() => {
    const forums: (ForumPreset & { categoryName: string })[] = [];
    FORUM_CATEGORIES.forEach(cat => {
      cat.forums.forEach(f => forums.push({ ...f, categoryName: cat.name }));
    });
    return forums;
  }, []);

  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return allPresets;
    const q = presetSearch.toLowerCase();
    return allPresets.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.url.toLowerCase().includes(q) ||
      f.categoryName.toLowerCase().includes(q) ||
      (f.token && f.token.toLowerCase().includes(q))
    );
  }, [allPresets, presetSearch]);

  // Match a sync job to a tenant by normalizing URLs
  const getSyncJob = useCallback((forumUrl: string): SyncJob | undefined => {
    const normalized = forumUrl.replace(/\/$/, '').toLowerCase();
    return syncJobs.find(j => j.forum_url.replace(/\/$/, '').toLowerCase() === normalized);
  }, [syncJobs]);

  // Find orphan sync jobs — forums synced but not added as analytics tenants
  const orphanSyncJobs = useMemo(() => {
    const tenantUrls = new Set(tenants.map(t => t.forumUrl.replace(/\/$/, '').toLowerCase()));
    return syncJobs.filter(j => !tenantUrls.has(j.forum_url.replace(/\/$/, '').toLowerCase()));
  }, [syncJobs, tenants]);

  // Which URLs already have backfill jobs
  const syncedUrls = useMemo(() => {
    const set = new Set<string>();
    syncJobs.forEach(j => set.add(j.forum_url.replace(/\/$/, '').toLowerCase()));
    return set;
  }, [syncJobs]);

  // Summary counts
  const syncSummary = useMemo(() => {
    const complete = syncJobs.filter(j => j.status === 'complete').length;
    const running = syncJobs.filter(j => j.status === 'running').length;
    const pending = syncJobs.filter(j => j.status === 'pending').length;
    const failed = syncJobs.filter(j => j.status === 'failed').length;
    return { complete, running, pending, failed, total: syncJobs.length };
  }, [syncJobs]);

  const fetchData = useCallback(async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const [tenantsRes, backfillRes] = await Promise.all([
        fetch('/api/delegates/admin', { headers: authHeaders }),
        fetch('/api/backfill', { headers: authHeaders }),
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
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for sync progress when any job is running/pending
  useEffect(() => {
    const hasActive = syncJobs.some(j => j.status === 'running' || j.status === 'pending');
    if (!hasActive) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [syncJobs, fetchData]);

  const handleInitSchema = async () => {
    setActionLoading('init-schema');
    try {
      const ph = await getPostHeaders();
      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: ph,
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

      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: await getPostHeaders(),
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

      setFormSuccess(`Forum "${formName}" created. Starting sync...`);
      setActionLoading('initial-sync');

      // Auto-start backfill
      try {
        await fetch('/api/backfill', {
          method: 'POST',
          headers: await getPostHeaders(),
          body: JSON.stringify({ action: 'start', forumUrl: normalizedUrl }),
        });
      } catch { /* best-effort */ }

      // Also trigger contributor data pull
      try {
        await fetch(`/api/delegates/${formSlug}/refresh`, {
          method: 'POST',
          headers: await getPostHeaders(),
        });
      } catch { /* best-effort */ }

      setFormSuccess(`Forum "${formName}" created and sync started.`);

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
        headers: await getPostHeaders(),
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
        headers: await getPostHeaders(),
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
        headers: await getPostHeaders(),
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
        headers: await getPostHeaders(),
        body: JSON.stringify({ action: 'run-cycle' }),
      });
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to run sync cycle');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Delegate management ---

  const fetchDelegates = useCallback(async (slug: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/delegates/admin?tenant=${slug}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setDelegatesByTenant(prev => ({ ...prev, [slug]: data.delegates || [] }));
      }
    } catch { /* ignore */ }
  }, [getAuthHeaders]);

  // Fetch delegates when a tenant is expanded
  useEffect(() => {
    if (expandedTenant) {
      fetchDelegates(expandedTenant);
    }
  }, [expandedTenant, fetchDelegates]);

  const handleDeleteDelegate = async (slug: string, username: string) => {
    setActionLoading(`delete-delegate-${slug}-${username}`);
    try {
      const ph = await getPostHeaders();
      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: ph,
        body: JSON.stringify({ action: 'delete-delegate', tenantSlug: slug, username }),
      });
      if (res.ok) {
        await fetchDelegates(slug);
      }
    } catch { /* ignore */ }
    setActionLoading(null);
    setDeleteConfirm(null);
  };

  // Debounced user search for autocomplete
  useEffect(() => {
    if (addUsername.length < 2 || selectedSearchUser) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (!showDelegateUpload) return;
      setSearchLoading(true);
      setSearchError(null);
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(
          `/api/delegates/admin/search?tenantSlug=${encodeURIComponent(showDelegateUpload)}&term=${encodeURIComponent(addUsername)}`,
          { headers: authHeaders }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
          if (data.users?.length === 0) {
            setSearchError('No users found. You can still type a username and click Add.');
          }
        } else {
          const data = await res.json().catch(() => ({ error: 'Search request failed' }));
          setSearchError(data.error || 'Search failed');
          setSearchResults([]);
        }
      } catch {
        setSearchError('Network error — could not reach search API');
        setSearchResults([]);
      }
      finally { setSearchLoading(false); }
    }, 300);

    return () => clearTimeout(timer);
  }, [addUsername, showDelegateUpload, selectedSearchUser, getAuthHeaders]);

  // Compute the effective role for single-add
  const effectiveRole = addRole === '__custom__' ? customRole.trim() : addRole;

  const parseCsv = (text: string): { username: string; displayName?: string; walletAddress?: string; programs?: string[]; role?: string }[] => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];

    // Detect if first line is a header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('username') || firstLine.includes('display') || firstLine.includes('wallet') || firstLine.includes('role');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map(line => {
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      const entry: { username: string; displayName?: string; walletAddress?: string; programs?: string[]; role?: string } = {
        username: parts[0],
      };
      if (parts[1]) entry.displayName = parts[1];
      if (parts[2]) entry.walletAddress = parts[2];
      if (parts[3]) entry.programs = parts[3].split(/[;|]/).map(p => p.trim()).filter(Boolean);
      if (parts[4]) entry.role = parts[4];
      return entry;
    }).filter(e => e.username);
  };

  const handleCsvUpload = async (slug: string) => {
    const delegates = parseCsv(csvText);
    if (delegates.length === 0) {
      setFormError('No valid delegates found in CSV. Each line needs at least a username.');
      return;
    }

    setActionLoading(`upload-delegates-${slug}`);
    setUploadResult(null);
    try {
      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: await getPostHeaders(),
        body: JSON.stringify({
          action: 'bulk-upsert-delegates',
          tenantSlug: slug,
          delegates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to upload delegates');
        return;
      }
      setUploadResult({ created: data.created, errors: data.errors || [] });
      setCsvText('');
      await fetchDelegates(slug);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSingleDelegate = async (slug: string) => {
    const username = selectedSearchUser?.username || addUsername.trim();
    if (!username) return;
    setActionLoading(`add-delegate-${slug}`);
    try {
      const delegateData: Record<string, unknown> = { username };
      if (selectedSearchUser?.name) {
        delegateData.displayName = selectedSearchUser.name;
      }
      const role = effectiveRole;
      if (role) delegateData.role = role;

      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: await getPostHeaders(),
        body: JSON.stringify({
          action: 'bulk-upsert-delegates',
          tenantSlug: slug,
          delegates: [delegateData],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to add delegate');
        return;
      }
      if (data.errors?.length > 0) {
        setFormError(data.errors[0].error);
      }
      setAddUsername('');
      setSelectedSearchUser(null);
      setSearchResults([]);
      setAddRole('');
      setCustomRole('');
      await fetchDelegates(slug);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add delegate');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateTenant = async (slug: string) => {
    setActionLoading(`update-tenant-${slug}`);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        action: 'update-tenant',
        tenantSlug: slug,
        apiUsername: editApiUsername,
      };
      if (editApiKey.trim()) {
        payload.apiKey = editApiKey.trim();
      }
      const res = await fetch('/api/delegates/admin', {
        method: 'POST',
        headers: await getPostHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update tenant');
        return;
      }
      // Update local tenant state with new values
      setTenants(prev => prev.map(t => t.slug === slug ? {
        ...t,
        apiUsername: editApiUsername,
        capabilities: data.capabilities || t.capabilities,
      } : t));
      setEditingTenant(null);
      setEditApiKey('');
      setEditShowKey(false);
      setFormSuccess('Tenant updated — capabilities re-detected');
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update tenant');
    } finally {
      setActionLoading(null);
    }
  };

  // Pre-fill the add form from a preset
  const prefillFromPreset = (preset: ForumPreset) => {
    setFormName(preset.name);
    const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setFormSlug(slug);
    setFormUrl(preset.url.replace(/\/$/, ''));
    setFormApiUsername('system');
    setFormApiKey('');
    setShowAddForm(true);
    setShowPresetPicker(false);
    setFormError(null);
    setFormSuccess(null);
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
      case 'failed': return { label: 'Sync failed', color: '#ef4444', pulse: false };
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

  const totalForums = tenants.length + orphanSyncJobs.length;

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4" style={{ color: textMuted }} />
          <span className="text-sm font-medium" style={{ color: textPrimary }}>Forum Analytics</span>
          {totalForums > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: btnBg, color: textMuted }}>
              {totalForums}
            </span>
          )}
          {syncSummary.total > 0 && (
            <div className="flex items-center gap-3 ml-2 text-[11px]" style={{ color: textDim }}>
              {syncSummary.complete > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isDark ? '#e5e5e5' : '#52525b' }} />{syncSummary.complete} synced</span>}
              {(syncSummary.running + syncSummary.pending) > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: isDark ? '#e5e5e5' : '#52525b' }} />{syncSummary.running + syncSummary.pending} active</span>}
              {syncSummary.failed > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />{syncSummary.failed} failed</span>}
            </div>
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
          {syncJobs.some(j => j.status === 'pending' || j.status === 'running') && (
            <button onClick={handleRunCycle} disabled={actionLoading !== null}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
              style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
              {actionLoading === 'run-cycle' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run Sync Cycle
            </button>
          )}
          {schemaReady && (
            <button onClick={() => { setShowPresetPicker(!showPresetPicker); if (showAddForm) setShowAddForm(false); setFormError(null); setFormSuccess(null); }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-opacity"
              style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
              <Search className="w-3.5 h-3.5" />
              {showPresetPicker ? 'Hide' : 'Browse Forums'}
            </button>
          )}
          {schemaReady && (
            <button onClick={() => { setShowAddForm(!showAddForm); if (showPresetPicker) setShowPresetPicker(false); setFormError(null); setFormSuccess(null); }}
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

      {/* Forum Preset Picker */}
      {showPresetPicker && schemaReady && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${cardBorder}` }}>
          <div className="p-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
              <input type="text" value={presetSearch} onChange={e => setPresetSearch(e.target.value)}
                placeholder="Search known forums..."
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: inputBg, color: textPrimary }}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredPresets.map(forum => {
              const normalizedUrl = forum.url.replace(/\/$/, '').toLowerCase();
              const hasTenant = tenants.some(t => t.forumUrl.replace(/\/$/, '').toLowerCase() === normalizedUrl);
              const isSynced = syncedUrls.has(normalizedUrl);
              const job = syncJobs.find(j => j.forum_url.replace(/\/$/, '').toLowerCase() === normalizedUrl);
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
                  <div className="flex-shrink-0 ml-3 flex items-center gap-2">
                    {hasTenant ? (
                      <span className="text-[11px] font-medium" style={{ color: textMuted }}>Added</span>
                    ) : isSynced && job ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]" style={{ color: textMuted }}>{job.status} ({job.topics_fetched.toLocaleString()})</span>
                        <button onClick={() => prefillFromPreset(forum)}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-opacity"
                          style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
                          <ArrowRight className="w-3 h-3" /> Activate
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => prefillFromPreset(forum)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-opacity"
                        style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2 text-xs" style={{ borderTop: `1px solid ${cardBorder}`, color: textDim }}>
            {filteredPresets.length} forums available · {tenants.length} active
          </div>
        </div>
      )}

      {/* Add Forum Form */}
      {showAddForm && schemaReady && (
        <form onSubmit={handleCreateTenant} className="mb-4 rounded-xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
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

      {/* Active Forums List */}
      {schemaReady && tenants.length === 0 && orphanSyncJobs.length === 0 && !showAddForm && !showPresetPicker && (
        <p className="text-sm" style={{ color: textMuted }}>
          No forums configured yet. Click &quot;Add Forum&quot; or &quot;Browse Forums&quot; to get started.
        </p>
      )}

      {(tenants.length > 0 || orphanSyncJobs.length > 0) && (
        <div className="space-y-2">
          {/* Fully configured tenants */}
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
                    <Link href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg transition-opacity"
                      style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}` }}
                      title="View dashboard (opens in new tab)">
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

                    {/* Tracked Members */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: textMuted }}>
                          <Users className="w-3 h-3" />
                          Tracked Members
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: btnBg, color: textDim }}>
                            {(delegatesByTenant[tenant.slug] || []).length}
                          </span>
                        </p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setShowDelegateUpload(showDelegateUpload === tenant.slug ? null : tenant.slug); setUploadResult(null); setCsvText(''); setAddUsername(''); setAddRole(''); setCustomRole(''); setSelectedSearchUser(null); setSearchResults([]); setSearchError(null); setShowHelp(false); setFormError(null); }}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-opacity"
                            style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
                            {showDelegateUpload === tenant.slug ? <X className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                            {showDelegateUpload === tenant.slug ? 'Close' : 'Add Members'}
                          </button>
                        </div>
                      </div>

                      {/* Add members panel */}
                      {showDelegateUpload === tenant.slug && (
                        <div className="rounded-lg p-3 mb-2 space-y-3" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                          {/* Search / single add */}
                          <div>
                            <label className="block text-[11px] mb-1" style={{ color: textDim }}>Search forum users or enter a username</label>
                            <div className="relative">
                              <div className="flex gap-2">
                                {selectedSearchUser ? (
                                  <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                                    style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
                                    {selectedSearchUser.avatarUrl && (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img src={selectedSearchUser.avatarUrl} alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
                                    )}
                                    <span className="font-medium">{selectedSearchUser.username}</span>
                                    {selectedSearchUser.name && (
                                      <span style={{ color: textDim }}>{selectedSearchUser.name}</span>
                                    )}
                                    <button onClick={() => { setSelectedSearchUser(null); setAddUsername(''); setSearchResults([]); }}
                                      className="ml-auto p-0.5 rounded hover:opacity-70" style={{ color: textMuted }}>
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex-1 relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: textDim }} />
                                    <input type="text" value={addUsername} onChange={e => { setAddUsername(e.target.value); setSelectedSearchUser(null); }}
                                      placeholder="Search by username or name..."
                                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSingleDelegate(tenant.slug); } }}
                                      className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
                                      style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }} />
                                    {searchLoading && (
                                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin" style={{ color: textDim }} />
                                    )}
                                  </div>
                                )}
                                <button onClick={() => handleAddSingleDelegate(tenant.slug)}
                                  disabled={actionLoading !== null || (!addUsername.trim() && !selectedSearchUser)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity disabled:opacity-40"
                                  style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
                                  {actionLoading === `add-delegate-${tenant.slug}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                  Add
                                </button>
                              </div>
                              {/* Search results dropdown */}
                              {searchResults.length > 0 && !selectedSearchUser && (
                                <div className="absolute z-20 left-0 right-12 mt-1 rounded-lg overflow-hidden shadow-lg"
                                  style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}` }}>
                                  {searchResults.map(user => {
                                    const alreadyTracked = (delegatesByTenant[tenant.slug] || []).some(d => d.username === user.username);
                                    return (
                                      <button key={user.username}
                                        onClick={() => {
                                          if (!alreadyTracked) {
                                            setSelectedSearchUser(user);
                                            setAddUsername(user.username);
                                            setSearchResults([]);
                                            setSearchError(null);
                                          }
                                        }}
                                        disabled={alreadyTracked}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors disabled:opacity-50"
                                        style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}
                                        onMouseEnter={e => { if (!alreadyTracked) e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                        {user.avatarUrl ? (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img src={user.avatarUrl} alt="" width={20} height={20} style={{ borderRadius: '50%', flexShrink: 0 }} />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                                            style={{ backgroundColor: btnBg, color: textMuted, flexShrink: 0 }}>
                                            {user.username[0].toUpperCase()}
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <span className="text-xs font-medium" style={{ color: textPrimary }}>{user.username}</span>
                                          {user.name && <span className="text-[10px] ml-1.5" style={{ color: textDim }}>{user.name}</span>}
                                        </div>
                                        {alreadyTracked && (
                                          <span className="ml-auto text-[10px]" style={{ color: textDim }}>(already tracked)</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              {searchError && !selectedSearchUser && addUsername.length >= 2 && !searchLoading && (
                                <div className="text-[10px] mt-1 px-1" style={{ color: textDim }}>
                                  {searchError}
                                </div>
                              )}
                            </div>

                            {/* Role picker */}
                            <div className="flex items-center gap-2 mt-2">
                              <label className="text-[10px] flex-shrink-0" style={{ color: textDim }}>Role:</label>
                              <select value={addRole} onChange={e => { setAddRole(e.target.value); if (e.target.value !== '__custom__') setCustomRole(''); }}
                                className="px-2 py-1 rounded text-xs outline-none"
                                style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }}>
                                <option value="">No role</option>
                                {DELEGATE_ROLES.map(r => (
                                  <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                                <option value="__custom__">Custom...</option>
                              </select>
                              {addRole === '__custom__' && (
                                <input type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
                                  placeholder="Custom role name"
                                  className="px-2 py-1 rounded text-xs outline-none flex-1"
                                  style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }} />
                              )}
                            </div>

                            <p className="text-[10px] mt-1" style={{ color: textDim }}>Display name will be auto-fetched from the forum</p>
                          </div>

                          {/* Help section */}
                          <div>
                            <button onClick={() => setShowHelp(!showHelp)}
                              className="flex items-center gap-1 text-[11px] transition-opacity"
                              style={{ color: textMuted }}>
                              {showHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              How to add members
                            </button>
                            {showHelp && (
                              <div className="mt-2 rounded-lg p-3 text-[11px] space-y-2" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, color: textMuted }}>
                                <p><span className="font-medium" style={{ color: textSecondary }}>Search:</span> Start typing a Discourse username or display name to search the forum. Select a user from the dropdown.</p>
                                <p><span className="font-medium" style={{ color: textSecondary }}>Manual:</span> If search isn&apos;t available, type the exact Discourse username and press Add.</p>
                                <p><span className="font-medium" style={{ color: textSecondary }}>Bulk export from Discourse:</span> Go to Admin &rarr; Users, click Export. Extract the username column and paste below as CSV.</p>
                                <p><span className="font-medium" style={{ color: textSecondary }}>CSV format:</span> <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>username, display_name, wallet_address, programs, role</code></p>
                                <p>Only <span className="font-medium">username</span> is required. Programs use <code className="font-mono text-[10px]">;</code> as separator. Roles: {DELEGATE_ROLES.map(r => r.id).join(', ')}, or any custom string.</p>
                              </div>
                            )}
                          </div>

                          {/* CSV upload */}
                          <div>
                            <label className="block text-[11px] mb-1" style={{ color: textDim }}>
                              Or paste CSV (username, display_name, wallet_address, programs, role)
                            </label>
                            <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
                              placeholder={"username, display_name, wallet_address, programs, role\nalice, Alice Smith, 0x123..., Council;Grants, delegate\nbob, , , , council_member\ncharlie, Charlie D"}
                              rows={4}
                              className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono resize-y"
                              style={{ backgroundColor: inputBg, border: `1px solid ${btnBorder}`, color: textPrimary }} />
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-[10px]" style={{ color: textDim }}>
                                Only <span className="font-medium">username</span> is required. Other columns are optional.
                              </p>
                              <button onClick={() => handleCsvUpload(tenant.slug)}
                                disabled={actionLoading !== null || !csvText.trim()}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity disabled:opacity-40"
                                style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
                                {actionLoading === `upload-delegates-${tenant.slug}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                Upload CSV
                              </button>
                            </div>
                          </div>

                          {/* Upload result */}
                          {uploadResult && (
                            <div className="rounded-lg p-2 text-xs" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${cardBorder}` }}>
                              <p style={{ color: textSecondary }}>
                                <Check className="w-3 h-3 inline mr-1" />
                                {uploadResult.created} member{uploadResult.created !== 1 ? 's' : ''} added/updated
                                {uploadResult.errors.length > 0 && <span style={{ color: '#f59e0b' }}> · {uploadResult.errors.length} warning{uploadResult.errors.length !== 1 ? 's' : ''}</span>}
                              </p>
                              {uploadResult.errors.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {uploadResult.errors.map((e, i) => (
                                    <p key={i} style={{ color: textDim }}>{e.username}: {e.error}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Delegate list */}
                      {(delegatesByTenant[tenant.slug] || []).length > 0 ? (
                        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                          <div className="max-h-64 overflow-y-auto">
                            {(delegatesByTenant[tenant.slug] || []).map(d => (
                              <div key={d.id} className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` }}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-medium truncate" style={{ color: textPrimary }}>{d.displayName}</span>
                                  <span className="text-[10px] font-mono" style={{ color: textDim }}>@{d.username}</span>
                                  {d.role && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                                      backgroundColor: `${getRoleColor(d.role)}15`,
                                      border: `1px solid ${getRoleColor(d.role)}33`,
                                      color: getRoleColor(d.role),
                                    }}>
                                      {getRoleLabel(d.role)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {d.programs && d.programs.length > 0 && (
                                    <span className="text-[10px]" style={{ color: textDim }}>{d.programs.join(', ')}</span>
                                  )}
                                  <a href={`${tenant.forumUrl}/u/${d.username}`} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] hover:underline" style={{ color: textMuted }}>
                                    profile
                                  </a>
                                  <button
                                    onClick={() => setDeleteConfirm({ slug: tenant.slug, username: d.username, displayName: d.displayName })}
                                    className="p-1 rounded hover:bg-red-500/10 transition-colors"
                                    style={{ color: textDim }}
                                    title={`Remove ${d.displayName}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: textDim }}>
                          No members tracked yet. Add Discourse usernames to start monitoring their activity.
                        </p>
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

                    {/* Edit Settings */}
                    {editingTenant === tenant.slug ? (
                      <div className="rounded-lg p-3 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: inputBg }}>
                        <p className="text-xs font-medium" style={{ color: textMuted }}>Edit API Settings</p>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: textDim }}>API Key</label>
                          <div className="flex gap-2">
                            <input
                              type={editShowKey ? 'text' : 'password'}
                              value={editApiKey}
                              onChange={e => setEditApiKey(e.target.value)}
                              placeholder="Leave blank to keep current key"
                              className="flex-1 px-2 py-1.5 text-xs font-mono rounded-lg"
                              style={{ backgroundColor: isDark ? '#0a0a0a' : '#ffffff', border: `1px solid ${cardBorder}`, color: textPrimary }}
                            />
                            <button onClick={() => setEditShowKey(!editShowKey)}
                              className="px-2 py-1.5 rounded-lg text-xs"
                              style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textMuted }}>
                              {editShowKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: textDim }}>API Username</label>
                          <input
                            type="text"
                            value={editApiUsername}
                            onChange={e => setEditApiUsername(e.target.value)}
                            placeholder="Leave blank for All Users keys"
                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg"
                            style={{ backgroundColor: isDark ? '#0a0a0a' : '#ffffff', border: `1px solid ${cardBorder}`, color: textPrimary }}
                          />
                          <p className="text-[10px] mt-1" style={{ color: textDim }}>
                            Leave blank for &quot;All Users&quot; API keys. Set to &quot;system&quot; for per-user keys.
                          </p>
                        </div>
                        {formError && <p className="text-xs text-red-400">{formError}</p>}
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleUpdateTenant(tenant.slug)}
                            disabled={actionLoading === `update-tenant-${tenant.slug}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg"
                            style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
                            {actionLoading === `update-tenant-${tenant.slug}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save & Retest
                          </button>
                          <button onClick={() => { setEditingTenant(null); setEditApiKey(''); setEditShowKey(false); setFormError(null); }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg"
                            style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textMuted }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingTenant(tenant.slug); setEditApiUsername(tenant.apiUsername || ''); setEditApiKey(''); setEditShowKey(false); setFormError(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity"
                        style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textMuted }}>
                        <Pencil className="w-3 h-3" /> Edit API Settings
                      </button>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <a href={tenant.forumUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-opacity"
                        style={{ backgroundColor: btnBg, border: `1px solid ${btnBorder}`, color: textMuted }}>
                        <ExternalLink className="w-3 h-3" /> Visit Forum
                      </a>
                      <Link href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer"
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

          {/* Orphan sync jobs — synced but not yet activated for analytics */}
          {orphanSyncJobs.length > 0 && (
            <>
              {tenants.length > 0 && (
                <div className="flex items-center gap-2 pt-4 pb-1">
                  <div className="flex-1 h-px" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
                  <span className="text-[11px] font-medium px-2 whitespace-nowrap" style={{ color: textDim }}>Pending setup — add API key to activate</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
                </div>
              )}
              {orphanSyncJobs.map(job => {
                const syncStatus = getSyncStatusLabel(job);
                const matchingPreset = allPresets.find(p => p.url.replace(/\/$/, '').toLowerCase() === job.forum_url.replace(/\/$/, '').toLowerCase());
                return (
                  <div key={job.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                    <div className="flex items-center gap-3 px-4 py-3"
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: textPrimary }}>{job.forum_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Sync only</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs truncate" style={{ color: textDim }}>{job.forum_url}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ color: syncStatus.color, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                            <span className={`w-1.5 h-1.5 rounded-full ${syncStatus.pulse ? 'animate-pulse' : ''}`} style={{ backgroundColor: syncStatus.color }} />
                            {syncStatus.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => {
                          if (matchingPreset) {
                            prefillFromPreset(matchingPreset);
                          } else {
                            setFormName(job.forum_name);
                            const slug = job.forum_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                            setFormSlug(slug);
                            setFormUrl(job.forum_url.replace(/\/$/, ''));
                            setFormApiUsername('system');
                            setFormApiKey('');
                            setShowAddForm(true);
                            setFormError(null);
                            setFormSuccess(null);
                          }
                        }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-opacity"
                          style={{ backgroundColor: isDark ? '#ffffff' : '#18181b', color: isDark ? '#09090b' : '#fafafa' }}>
                          <ArrowRight className="w-3 h-3" /> Activate Analytics
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Remove delegate"
        message={deleteConfirm ? `Remove "${deleteConfirm.displayName}" (@${deleteConfirm.username})? All snapshot history for this delegate will be permanently deleted.` : ''}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { if (deleteConfirm) handleDeleteDelegate(deleteConfirm.slug, deleteConfirm.username); }}
        onCancel={() => setDeleteConfirm(null)}
        isDark={isDark}
      />
    </div>
  );
}


// --- Role helpers ---

function getRoleColor(role: string): string {
  switch (role) {
    case 'delegate': return '#6366f1';          // indigo
    case 'council_member': return '#8b5cf6';    // violet
    case 'major_stakeholder': return '#f59e0b';  // amber
    case 'contributor': return '#10b981';        // emerald
    case 'grantee': return '#06b6d4';           // cyan
    case 'core_team': return '#ec4899';          // pink
    case 'advisor': return '#f97316';            // orange
    default: return '#71717a';                   // zinc (custom roles)
  }
}

function getRoleLabel(role: string): string {
  const found = DELEGATE_ROLES.find(r => r.id === role);
  return found ? found.label : role;
}

interface ForumHealth {
  name: string;
  url: string;
  status: 'ok' | 'error' | 'not_cached';
  topicCount: number;
  lastFetched: number | null;
  error?: string;
}

function ForumHealthSection({ getAuthHeaders, isDark = true }: { getAuthHeaders: () => Promise<Record<string, string>>; isDark?: boolean }) {
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
