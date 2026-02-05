'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { RefreshCw, Database, Server, Users, MessageSquare, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';

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
      // Fetch system stats
      const statsRes = await fetch('/api/admin', {
        headers: { 'x-admin-email': adminEmail }
      });
      if (statsRes.ok) {
        setStats(await statsRes.json());
      } else if (statsRes.status === 401) {
        setError('Unauthorized - not an admin');
        return;
      }

      // Fetch backfill status
      const backfillRes = await fetch('/api/backfill', {
        headers: { 'x-admin-email': adminEmail }
      });
      if (backfillRes.ok) {
        setBackfillStatus(await backfillRes.json());
      }

      // Fetch users
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
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    } else if (ready && !authenticated) {
      setLoading(false);
      setError('Please log in to access admin panel');
    }
  }, [ready, authenticated, adminEmail, fetchData]);

  const handleAction = async (action: string, body?: object) => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
        },
        body: JSON.stringify({ action, ...body }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }
      
      // Refresh data after action
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
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (error === 'Unauthorized - not an admin' || error === 'Please log in to access admin panel') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Access Denied</h1>
          <p className="text-[var(--color-text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">👁️‍🗨️ Admin Dashboard</h1>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              {lastRefresh && `Last updated: ${lastRefresh.toLocaleTimeString()}`}
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error && error !== 'Unauthorized - not an admin' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Database */}
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="font-semibold text-[var(--color-text-primary)]">Database</h2>
              <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
                stats?.database?.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {stats?.database?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {stats?.database?.connected ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Forums</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{stats.database.forums}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Topics</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{stats.database.topics?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">New (24h)</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{stats.database.newTopicsLast24h?.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-400">{stats?.database?.error}</p>
            )}
          </div>

          {/* Redis */}
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Server className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="font-semibold text-[var(--color-text-primary)]">Redis Cache</h2>
              <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
                stats?.redis?.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {stats?.redis?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {stats?.redis?.connected && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Cached Forums</span>
                  <span className="text-[var(--color-text-primary)] font-mono">{stats.redis.cachedForums}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-tertiary)]">Last Refresh</span>
                  <span className="text-[var(--color-text-primary)] font-mono text-xs">
                    {stats.redis.lastRefresh ? new Date(stats.redis.lastRefresh).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Memory Cache */}
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className={`w-5 h-5 text-[var(--color-accent)] ${stats?.memoryCache?.isRefreshing ? 'animate-spin' : ''}`} />
              <h2 className="font-semibold text-[var(--color-text-primary)]">Memory Cache</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-tertiary)]">Cached</span>
                <span className="text-[var(--color-text-primary)] font-mono">{stats?.memoryCache?.size || 0} forums</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-tertiary)]">Status</span>
                <span className="text-[var(--color-text-primary)]">
                  {stats?.memoryCache?.isRefreshing ? '🔄 Refreshing...' : '✓ Idle'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
          <h2 className="font-semibold text-[var(--color-text-primary)] mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleAction('init-schema')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              {actionLoading === 'init-schema' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Init Schema
            </button>
            <button
              onClick={() => handleAction('refresh-cache')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              {actionLoading === 'refresh-cache' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh Cache
            </button>
            <button
              onClick={() => handleAction('clear-redis-cache')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'clear-redis-cache' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Clear Redis
            </button>
          </div>
        </div>

        {/* Backfill Status */}
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--color-text-primary)]">Historical Backfill</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-green-400">✓ {backfillStatus?.complete || 0} complete</span>
              <span className="text-yellow-400">◐ {backfillStatus?.running || 0} running</span>
              <span className="text-[var(--color-text-tertiary)]">○ {backfillStatus?.pending || 0} pending</span>
              {(backfillStatus?.failed || 0) > 0 && (
                <span className="text-red-400">✗ {backfillStatus?.failed} failed</span>
              )}
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => handleBackfillAction('init-all')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] rounded hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              Queue All Forums
            </button>
            <button
              onClick={() => handleBackfillAction('run-cycle')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded hover:opacity-90 transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Run Cycle
            </button>
          </div>

          {backfillStatus?.jobs && backfillStatus.jobs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
                    <th className="pb-2 pr-4">Forum</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Progress</th>
                    <th className="pb-2 pr-4">Topics</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backfillStatus.jobs.slice(0, 10).map((job) => (
                    <tr key={job.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2 pr-4">
                        <a 
                          href={job.forum_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          {job.forum_name}
                        </a>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          job.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                          job.status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                          job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          job.status === 'paused' ? 'bg-gray-500/20 text-gray-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-[var(--color-text-tertiary)]">
                        Page {job.current_page}{job.total_pages ? ` / ${job.total_pages}` : ''}
                      </td>
                      <td className="py-2 pr-4 font-mono">{job.topics_fetched.toLocaleString()}</td>
                      <td className="py-2">
                        {job.status === 'running' && (
                          <button
                            onClick={() => handleBackfillAction('pause', job.id)}
                            className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === 'paused' && (
                          <button
                            onClick={() => handleBackfillAction('resume', job.id)}
                            className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded"
                            title="Resume"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === 'failed' && (
                          <button
                            onClick={() => handleBackfillAction('retry', job.id)}
                            className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded"
                            title="Retry"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {backfillStatus.jobs.length > 10 && (
                <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                  Showing 10 of {backfillStatus.jobs.length} jobs
                </p>
              )}
            </div>
          )}
        </div>

        {/* Users */}
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-[var(--color-accent)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">Users ({users.length})</h2>
          </div>
          
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Alerts</th>
                    <th className="pb-2 pr-4">Bookmarks</th>
                    <th className="pb-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2 pr-4 text-[var(--color-text-primary)]">{user.email || user.privy_did}</td>
                      <td className="py-2 pr-4 font-mono">{user.alert_count}</td>
                      <td className="py-2 pr-4 font-mono">{user.bookmark_count}</td>
                      <td className="py-2 text-[var(--color-text-tertiary)]">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[var(--color-text-tertiary)]">No users yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
