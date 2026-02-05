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

  if (!ready || loading) {
    return (
      <div className="min-h-screen admin-bg admin-page flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl bg-violet-600/10" />
          <div className="absolute top-20 -left-20 w-60 h-60 rounded-full blur-3xl bg-cyan-600/10" />
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error === 'Unauthorized - not an admin' || error === 'Please log in to access admin panel') {
    return (
      <div className="min-h-screen admin-bg admin-page flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl bg-violet-600/10" />
          <div className="absolute top-20 -left-20 w-60 h-60 rounded-full blur-3xl bg-cyan-600/10" />
        </div>
        <div className="relative admin-card rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-white mb-4">Access Denied</h1>
          <p className="text-zinc-400">{error}</p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 mt-6 text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen admin-bg admin-text admin-page">
      {/* Ambient gradient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl bg-violet-600/10" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 rounded-full blur-3xl bg-cyan-600/8" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-60 rounded-full blur-3xl bg-indigo-600/8" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/app"
              className="p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <span className="text-2xl">👁️‍🗨️</span>
                Admin Dashboard
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {lastRefresh && `Last updated ${lastRefresh.toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error && error !== 'Unauthorized - not an admin' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Database */}
          <div className="admin-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-violet-500/10">
                <Database className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="font-semibold text-white">Database</h2>
              <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
                stats?.database?.connected 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {stats?.database?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {stats?.database?.connected ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">Forums</span>
                  <span className="text-white font-mono text-lg">{stats.database.forums}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">Topics</span>
                  <span className="text-white font-mono text-lg">{stats.database.topics?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">New (24h)</span>
                  <span className="text-emerald-400 font-mono text-lg">+{stats.database.newTopicsLast24h?.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-400">{stats?.database?.error}</p>
            )}
          </div>

          {/* Redis */}
          <div className="admin-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-cyan-500/10">
                <Server className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="font-semibold text-white">Redis Cache</h2>
              <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
                stats?.redis?.connected 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {stats?.redis?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {stats?.redis?.connected && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">Cached Forums</span>
                  <span className="text-white font-mono text-lg">{stats.redis.cachedForums}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">Last Refresh</span>
                  <span className="text-zinc-300 text-sm">
                    {stats.redis.lastRefresh ? new Date(stats.redis.lastRefresh).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Memory Cache */}
          <div className="admin-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <RefreshCw className={`w-5 h-5 text-amber-400 ${stats?.memoryCache?.isRefreshing ? 'animate-spin' : ''}`} />
              </div>
              <h2 className="font-semibold text-white">Memory Cache</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-sm">Cached</span>
                <span className="text-white font-mono text-lg">{stats?.memoryCache?.size || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-sm">Status</span>
                <span className={`text-sm ${stats?.memoryCache?.isRefreshing ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {stats?.memoryCache?.isRefreshing ? '🔄 Refreshing...' : '✓ Idle'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="admin-card rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleAction('init-schema')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'init-schema' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Init Schema
            </button>
            <button
              onClick={() => handleAction('refresh-cache')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'refresh-cache' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh Cache
            </button>
            <button
              onClick={() => handleAction('clear-redis-cache')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'clear-redis-cache' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Clear Redis
            </button>
          </div>
        </div>

        {/* Forum Health */}
        <ForumHealthSection adminEmail={adminEmail} />

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
        />

        {/* Users */}
        <div className="admin-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-indigo-500/10">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="font-semibold text-white">Users</h2>
            <span className="ml-2 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400">
              {users.length}
            </span>
          </div>
          
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800">
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Alerts</th>
                    <th className="pb-3 pr-4 font-medium">Bookmarks</th>
                    <th className="pb-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 pr-4 text-white">{u.email || u.privy_did.slice(0, 20) + '...'}</td>
                      <td className="py-3 pr-4 font-mono text-zinc-400">{u.alert_count}</td>
                      <td className="py-3 pr-4 font-mono text-zinc-400">{u.bookmark_count}</td>
                      <td className="py-3 text-zinc-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-zinc-500">No users yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function BackfillSection({ backfillStatus, actionLoading, onAction, onQueueForum, adminEmail }: {
  backfillStatus: BackfillStatus | null;
  actionLoading: string | null;
  onAction: (action: string, jobId?: number) => void;
  onQueueForum: (url: string) => Promise<void>;
  adminEmail: string;
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

  return (
    <div className="admin-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-white">Historical Backfill</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {backfillStatus?.complete || 0} complete
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {backfillStatus?.running || 0} running
          </span>
          <span className="flex items-center gap-1.5 text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-zinc-500" />
            {backfillStatus?.pending || 0} pending
          </span>
          {(backfillStatus?.failed || 0) > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              {backfillStatus?.failed} failed
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => setShowForumPicker(!showForumPicker)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all">
          <Plus className="w-3 h-3" />
          {showForumPicker ? 'Hide Forums' : 'Queue Forums'}
        </button>
        <button onClick={() => onAction('init-all')} disabled={actionLoading !== null}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all disabled:opacity-50">
          Queue All
        </button>
        <button onClick={() => onAction('run-cycle')} disabled={actionLoading !== null}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-200 text-zinc-900 hover:bg-zinc-300 rounded-lg transition-all disabled:opacity-50">
          <Play className="w-3 h-3" />
          Run Cycle
        </button>
      </div>

      {/* Forum Picker */}
      {showForumPicker && (
        <div className="mb-6 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search forums..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 text-white rounded-lg text-sm focus:outline-none"
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
                <div key={forum.url} className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">{forum.name}</span>
                      {forum.token && <span className="text-xs text-zinc-500 font-mono">${forum.token}</span>}
                      <span className="text-[11px] text-zinc-600">{forum.categoryName}</span>
                    </div>
                    <p className="text-xs text-zinc-600 truncate">{forum.url}</p>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    {isQueued && job ? (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        job.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                        job.status === 'running' ? 'bg-amber-500/10 text-amber-400' :
                        job.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {job.status} {job.topics_fetched > 0 ? `(${job.topics_fetched.toLocaleString()})` : ''}
                      </span>
                    ) : (
                      <button onClick={() => onQueueForum(forum.url)} disabled={isLoading || actionLoading !== null}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors disabled:opacity-50">
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Queue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2 border-t border-zinc-800 text-xs text-zinc-600">
            {filteredForums.length} forums · {queuedUrls.size} queued
          </div>
        </div>
      )}

      {/* Jobs Table */}
      {backfillStatus?.jobs && backfillStatus.jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-3 pr-4 font-medium">Forum</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Progress</th>
                <th className="pb-3 pr-4 font-medium">Topics</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backfillStatus.jobs.map((job) => (
                <tr key={job.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 pr-4">
                    <a href={job.forum_url} target="_blank" rel="noopener noreferrer"
                      className="text-zinc-300 hover:text-white transition-colors">
                      {job.forum_name}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      job.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      job.status === 'running' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      job.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      job.status === 'paused' ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' :
                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>{job.status}</span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-zinc-400">
                    Page {job.current_page}{job.total_pages ? ` / ${job.total_pages}` : ''}
                  </td>
                  <td className="py-3 pr-4 font-mono text-white">{job.topics_fetched.toLocaleString()}</td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      {job.status === 'running' && (
                        <button onClick={() => onAction('pause', job.id)}
                          className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors" title="Pause">
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {job.status === 'paused' && (
                        <button onClick={() => onAction('resume', job.id)}
                          className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors" title="Resume">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {job.status === 'failed' && (
                        <button onClick={() => onAction('retry', job.id)}
                          className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors" title="Retry">
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

function ForumHealthSection({ adminEmail }: { adminEmail: string }) {
  const [results, setResults] = useState<ForumHealth[]>([]);
  const [testing, setTesting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'issues'>('issues');

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

    // Test in batches of 5
    const batchSize = 5;
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
            return { ...r, status: 'error', error: data.error || 'Failed' };
          }));
        } catch (err) {
          setResults(prev => prev.map(r =>
            r.url === forum.url ? { ...r, status: 'error', error: 'Network error' } : r
          ));
        }
      }));
    }
    setTesting(false);
  };

  const issues = results.filter(r => r.status === 'error' || r.status === 'redirect');
  const displayResults = filter === 'issues' ? issues : results.filter(r => r.status !== 'pending');

  return (
    <div className="admin-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white">Forum Health</h2>
        <div className="flex items-center gap-3">
          {results.length > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-400">{results.filter(r => r.status === 'ok').length} ok</span>
              {issues.length > 0 && <span className="text-red-400">{issues.length} issues</span>}
              {results.filter(r => r.status === 'pending' || r.status === 'testing').length > 0 && (
                <span className="text-zinc-500">{results.filter(r => r.status === 'pending' || r.status === 'testing').length} remaining</span>
              )}
            </div>
          )}
          <button onClick={testForums} disabled={testing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all disabled:opacity-50">
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {testing ? 'Testing...' : 'Test All Forums'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setFilter('issues')}
              className={`px-2.5 py-1 text-xs rounded-md ${filter === 'issues' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              Issues Only ({issues.length})
            </button>
            <button onClick={() => setFilter('all')}
              className={`px-2.5 py-1 text-xs rounded-md ${filter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              All Tested
            </button>
          </div>

          {displayResults.length === 0 ? (
            <p className="text-sm text-zinc-500">{filter === 'issues' ? 'No issues found' : 'No results yet'}</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {displayResults.map(r => (
                <div key={r.url} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800/30">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{r.name}</span>
                    <span className="text-xs text-zinc-600 ml-2">{r.url}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    r.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' :
                    r.status === 'redirect' ? 'bg-amber-500/10 text-amber-400' :
                    r.status === 'error' ? 'bg-red-500/10 text-red-400' :
                    r.status === 'testing' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>
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
        <p className="text-sm text-zinc-500">Click "Test All Forums" to check which forum URLs are still reachable.</p>
      )}
    </div>
  );
}
