'use client';

import { createContext, useContext, ReactNode, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from './AuthProvider';
import type { Forum } from '@/types';

interface DataSyncContextType {
  isAuthenticated: boolean;
  userId: string | null;
  // Sync functions - call these when data changes
  syncForums: (forums: Forum[]) => void;
  syncAlerts: (alerts: { keyword: string; isEnabled: boolean }[]) => void;
  syncBookmarks: (bookmarks: { topicRefId: string; topicTitle: string; topicUrl: string; protocol: string; folder?: string | null }[]) => void;
  markAsRead: (topicRefId: string) => void;
  markAllAsRead: (topicRefIds: string[]) => void;
  syncTheme: (theme: 'dark' | 'light') => void;
  syncDensity: (density: 'compact' | 'standard' | 'cozy') => void;
  syncOnboarding: (completed: boolean) => void;
  // Migration function - call when user logs in to migrate localStorage to database
  migrateLocalData: () => Promise<void>;
  // Database data that was loaded (for initial hydration on login)
  serverData: ServerData | null;
  isLoadingServerData: boolean;
}

interface ServerData {
  forums: { cname: string; isEnabled: boolean }[];
  alerts: { id: string; keyword: string; isEnabled: boolean; createdAt: string }[];
  bookmarks: { id: string; topicRefId: string; topicTitle: string; topicUrl: string; protocol: string; folder?: string | null; createdAt: string }[];
  readState: Record<string, number>;
  preferences: { theme: 'dark' | 'light'; onboarding_completed: boolean; density?: 'compact' | 'standard' | 'cozy' };
}

const DataSyncContext = createContext<DataSyncContextType | null>(null);

export function useDataSync(): DataSyncContextType {
  const context = useContext(DataSyncContext);
  if (!context) {
    throw new Error('useDataSync must be used within DataSyncProvider');
  }
  return context;
}

// Debounced sync to avoid too many API calls
function useDebouncedSync() {
  const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  return useCallback((key: string, fn: () => Promise<void>, delay = 1000) => {
    if (timeoutRef.current[key]) {
      clearTimeout(timeoutRef.current[key]);
    }
    timeoutRef.current[key] = setTimeout(async () => {
      try {
        await fn();
      } catch (error) {
        console.error(`Sync error for ${key}:`, error);
      }
    }, delay);
  }, []);
}

export function DataSyncProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, getAccessToken } = useAuth();
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [isLoadingServerData, setIsLoadingServerData] = useState(false);
  const initializedRef = useRef(false);
  const debouncedSync = useDebouncedSync();

  const userId = user?.id || null;

  // Helper to get auth headers
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getAccessToken();
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
  }, [getAccessToken]);

  // Load user data from server when authenticated
  useEffect(() => {
    if (isAuthenticated && userId && !initializedRef.current) {
      initializedRef.current = true;
      loadUserData();
    } else if (!isAuthenticated) {
      initializedRef.current = false;
      setServerData(null);
    }
  }, [isAuthenticated, userId]);

  const loadUserData = useCallback(async () => {
    if (!userId) return;

    setIsLoadingServerData(true);
    try {
      const authHeaders = await getAuthHeaders();
      if (!authHeaders['Authorization']) return;

      // Ensure user exists in database
      await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          email: user?.email,
          walletAddress: user?.walletAddress,
        }),
      });

      // Fetch user data
      const response = await fetch('/api/user', {
        headers: authHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        setServerData({
          forums: data.user.forums,
          alerts: data.user.alerts,
          bookmarks: data.user.bookmarks,
          readState: data.user.readState,
          preferences: data.user.preferences,
        });
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoadingServerData(false);
    }
  }, [userId, user?.email, user?.walletAddress, getAuthHeaders]);

  // Sync functions
  const syncForums = useCallback((forums: Forum[]) => {
    if (!userId) return;
    debouncedSync('forums', async () => {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ forums }),
      });
    });
  }, [userId, debouncedSync, getAuthHeaders]);

  const syncAlerts = useCallback((alerts: { keyword: string; isEnabled: boolean }[]) => {
    if (!userId) return;
    debouncedSync('alerts', async () => {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ alerts }),
      });
    });
  }, [userId, debouncedSync, getAuthHeaders]);

  const syncBookmarks = useCallback((bookmarks: { topicRefId: string; topicTitle: string; topicUrl: string; protocol: string; folder?: string | null }[]) => {
    if (!userId) return;
    debouncedSync('bookmarks', async () => {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/bookmarks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ bookmarks }),
      });
    });
  }, [userId, debouncedSync, getAuthHeaders]);

  const markAsRead = useCallback((topicRefId: string) => {
    if (!userId) return;
    (async () => {
      const authHeaders = await getAuthHeaders();
      fetch('/api/user/read-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ topicRefId }),
      }).catch(console.error);
    })();
  }, [userId, getAuthHeaders]);

  const markAllAsRead = useCallback((topicRefIds: string[]) => {
    if (!userId) return;
    (async () => {
      const authHeaders = await getAuthHeaders();
      // Chunk under the server's 5000-id cap — "Mark Read" across many enabled
      // forums can exceed it in one click, and read-state PUT is upsert-only so
      // sequential chunks are lossless.
      const CHUNK = 2000;
      for (let i = 0; i < topicRefIds.length; i += CHUNK) {
        try {
          const res = await fetch('/api/user/read-state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ topicRefIds: topicRefIds.slice(i, i + CHUNK) }),
          });
          if (!res.ok) console.error('[Sync] read-state bulk sync failed:', res.status);
        } catch (err) {
          console.error(err);
        }
      }
    })();
  }, [userId, getAuthHeaders]);

  const syncTheme = useCallback((theme: 'dark' | 'light') => {
    if (!userId) return;
    debouncedSync('theme', async () => {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ theme }),
      });
    });
  }, [userId, debouncedSync, getAuthHeaders]);

  const syncDensity = useCallback((density: 'compact' | 'standard' | 'cozy') => {
    if (!userId) return;
    debouncedSync('density', async () => {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ density }),
      });
    });
  }, [userId, debouncedSync, getAuthHeaders]);

  const syncOnboarding = useCallback((completed: boolean) => {
    if (!userId) return;
    (async () => {
      const authHeaders = await getAuthHeaders();
      fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ onboardingCompleted: completed }),
      }).catch(console.error);
    })();
  }, [userId, getAuthHeaders]);

  // Migrate localStorage data to database (call after first login)
  const migrateLocalData = useCallback(async () => {
    if (!userId) return;

    const authHeaders = await getAuthHeaders();
    if (!authHeaders['Authorization']) return;

    // Get localStorage data
    const localForums = localStorage.getItem('discuss-watch-forums');
    const localAlerts = localStorage.getItem('discuss-watch-alerts');
    const localBookmarks = localStorage.getItem('discuss-watch-bookmarks');
    const localReadState = localStorage.getItem('discuss-watch-read-discussions');
    const localTheme = localStorage.getItem('discuss-watch-theme');
    const localOnboarding = localStorage.getItem('discuss-watch-onboarding-completed');

    const promises: Promise<Response>[] = [];

    // Migrate forums
    if (localForums) {
      try {
        const forums = JSON.parse(localForums);
        if (forums.length > 0) {
          promises.push(fetch('/api/user/forums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ forums }),
          }));
        }
      } catch (e) {
        console.error('Failed to migrate forums:', e);
      }
    }

    // Migrate alerts
    if (localAlerts) {
      try {
        const alerts = JSON.parse(localAlerts);
        if (alerts.length > 0) {
          promises.push(fetch('/api/user/alerts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              alerts: alerts.map((a: { keyword: string; isEnabled: boolean }) => ({
                keyword: a.keyword,
                isEnabled: a.isEnabled,
              })),
            }),
          }));
        }
      } catch (e) {
        console.error('Failed to migrate alerts:', e);
      }
    }

    // Migrate bookmarks
    if (localBookmarks) {
      try {
        const bookmarks = JSON.parse(localBookmarks);
        if (bookmarks.length > 0) {
          promises.push(fetch('/api/user/bookmarks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              bookmarks: bookmarks.map((b: { topicRefId: string; topicTitle: string; topicUrl: string; protocol: string }) => ({
                topicRefId: b.topicRefId,
                topicTitle: b.topicTitle,
                topicUrl: b.topicUrl,
                protocol: b.protocol,
              })),
            }),
          }));
        }
      } catch (e) {
        console.error('Failed to migrate bookmarks:', e);
      }
    }

    // Migrate read state
    if (localReadState) {
      try {
        const readState = JSON.parse(localReadState);
        const topicRefIds = Object.keys(readState);
        if (topicRefIds.length > 0) {
          promises.push(fetch('/api/user/read-state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ topicRefIds }),
          }));
        }
      } catch (e) {
        console.error('Failed to migrate read state:', e);
      }
    }

    // Migrate preferences
    const prefUpdates: { theme?: string; onboardingCompleted?: boolean } = {};
    if (localTheme === 'light' || localTheme === 'dark') {
      prefUpdates.theme = localTheme;
    }
    if (localOnboarding === 'true') {
      prefUpdates.onboardingCompleted = true;
    }
    if (Object.keys(prefUpdates).length > 0) {
      promises.push(fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(prefUpdates),
      }));
    }

    await Promise.allSettled(promises);

    // Refresh server data after migration
    await loadUserData();
  }, [userId, loadUserData, getAuthHeaders]);

  // Memoize so the context value is stable across renders — recreating it every
  // render forces every consumer of DataSyncContext to re-render.
  const value: DataSyncContextType = useMemo(() => ({
    isAuthenticated,
    userId,
    syncForums,
    syncAlerts,
    syncBookmarks,
    markAsRead,
    markAllAsRead,
    syncTheme,
    syncDensity,
    syncOnboarding,
    migrateLocalData,
    serverData,
    isLoadingServerData,
  }), [
    isAuthenticated, userId, syncForums, syncAlerts, syncBookmarks, markAsRead,
    markAllAsRead, syncTheme, syncDensity, syncOnboarding, migrateLocalData,
    serverData, isLoadingServerData,
  ]);

  return (
    <DataSyncContext.Provider value={value}>
      {children}
    </DataSyncContext.Provider>
  );
}
