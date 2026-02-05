'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { RefreshCw, Database, Server, Users, Play, Pause, RotateCcw, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
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
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl bg-violet-600/10" />
          <div className="absolute top-20 -left-20 w-60 h-60 rounded-full blur-3xl bg-cyan-600/10" />
        </div>
        <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 max-w-md text-center">
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
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
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
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6">
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
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6">
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
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6">
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
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6">
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

        {/* Backfill Status */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-white">Historical Backfill</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {backfillStatus?.complete || 0} complete
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                {backfillStatus?.running || 0} running
              </span>
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                {backfillStatus?.pending || 0} pending
              </span>
              {(backfillStatus?.failed || 0) > 0 && (
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  {backfillStatus?.failed} failed
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => handleBackfillAction('init-all')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all disabled:opacity-50"
            >
              Queue All Forums
            </button>
            <button
              onClick={() => handleBackfillAction('run-cycle')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg transition-all disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Run Cycle
            </button>
          </div>

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
                  {backfillStatus.jobs.slice(0, 10).map((job) => (
                    <tr key={job.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 pr-4">
                        <a 
                          href={job.forum_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300 transition-colors"
                        >
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
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-zinc-400">
                        Page {job.current_page}{job.total_pages ? ` / ${job.total_pages}` : ''}
                      </td>
                      <td className="py-3 pr-4 font-mono text-white">{job.topics_fetched.toLocaleString()}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          {job.status === 'running' && (
                            <button
                              onClick={() => handleBackfillAction('pause', job.id)}
                              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
                              title="Pause"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {job.status === 'paused' && (
                            <button
                              onClick={() => handleBackfillAction('resume', job.id)}
                              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
                              title="Resume"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {job.status === 'failed' && (
                            <button
                              onClick={() => handleBackfillAction('retry', job.id)}
                              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
                              title="Retry"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {backfillStatus.jobs.length > 10 && (
                <p className="text-sm text-zinc-500 mt-4">
                  Showing 10 of {backfillStatus.jobs.length} jobs
                </p>
              )}
            </div>
          )}
        </div>

        {/* Users */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6">
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
