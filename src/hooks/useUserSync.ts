'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface UserData {
  forums: { cname: string; isEnabled: boolean }[];
  customForums: {
    id: string;
    name: string;
    cname: string;
    description?: string;
    logoUrl?: string;
    token?: string;
    discourseUrl: string;
    discourseCategoryId?: number;
    isEnabled: boolean;
    createdAt: string;
  }[];
  alerts: {
    id: string;
    keyword: string;
    isEnabled: boolean;
    createdAt: string;
  }[];
  bookmarks: {
    id: string;
    topicRefId: string;
    topicTitle: string;
    topicUrl: string;
    protocol: string;
    createdAt: string;
  }[];
  readState: Record<string, number>;
  preferences: {
    theme: 'dark' | 'light';
    onboarding_completed: boolean;
  };
}

interface UseUserSyncReturn {
  userData: UserData | null;
  isLoading: boolean;
  isSynced: boolean;
  syncForums: (forums: { cname: string; isEnabled: boolean }[]) => Promise<void>;
  syncAlerts: (alerts: { keyword: string; isEnabled: boolean }[]) => Promise<void>;
  syncBookmarks: (bookmarks: { topicRefId: string; topicTitle: string; topicUrl: string; protocol: string }[]) => Promise<void>;
  markAsRead: (topicRefId: string) => Promise<void>;
  markAllAsRead: (topicRefIds: string[]) => Promise<void>;
  updatePreferences: (prefs: { theme?: 'dark' | 'light'; onboardingCompleted?: boolean }) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useUserSync(): UseUserSyncReturn {
  const { user, isAuthenticated, isLoading: authLoading, getAccessToken } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const initialFetchDone = useRef(false);

  // Helper to get auth headers
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const token = await getAccessToken();
      if (!token) return {};
      return { 'Authorization': `Bearer ${token}` };
    } catch {
      return {};
    }
  }, [getAccessToken]);

  // Create or get user in database and fetch data
  const initUser = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      // First, ensure user exists in database
      await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          email: user.email,
          walletAddress: user.walletAddress,
        }),
      });

      // Then fetch full user data
      const response = await fetch('/api/user', {
        headers: authHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
        setIsSynced(true);
      }
    } catch (error) {
      console.error('Failed to init user:', error);
      setIsSynced(false);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.email, user?.walletAddress, getAuthHeaders]);

  // Initialize user when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id && !initialFetchDone.current) {
      initialFetchDone.current = true;
      initUser();
    } else if (!isAuthenticated) {
      initialFetchDone.current = false;
      setUserData(null);
      setIsSynced(false);
    }
  }, [isAuthenticated, user?.id, initUser]);

  // Sync forums to database
  const syncForums = useCallback(async (forums: { cname: string; isEnabled: boolean }[]) => {
    if (!user?.id) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ forums }),
      });
    } catch (error) {
      console.error('Failed to sync forums:', error);
    }
  }, [user?.id, getAuthHeaders]);

  // Sync alerts to database
  const syncAlerts = useCallback(async (alerts: { keyword: string; isEnabled: boolean }[]) => {
    if (!user?.id) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ alerts }),
      });
    } catch (error) {
      console.error('Failed to sync alerts:', error);
    }
  }, [user?.id, getAuthHeaders]);

  // Sync bookmarks to database
  const syncBookmarks = useCallback(async (bookmarks: { topicRefId: string; topicTitle: string; topicUrl: string; protocol: string }[]) => {
    if (!user?.id) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/bookmarks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ bookmarks }),
      });
    } catch (error) {
      console.error('Failed to sync bookmarks:', error);
    }
  }, [user?.id, getAuthHeaders]);

  // Mark single topic as read
  const markAsRead = useCallback(async (topicRefId: string) => {
    if (!user?.id) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/read-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ topicRefId }),
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [user?.id, getAuthHeaders]);

  // Mark multiple topics as read
  const markAllAsRead = useCallback(async (topicRefIds: string[]) => {
    if (!user?.id) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/read-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ topicRefIds }),
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [user?.id, getAuthHeaders]);

  // Update preferences
  const updatePreferences = useCallback(async (prefs: { theme?: 'dark' | 'light'; onboardingCompleted?: boolean }) => {
    if (!user?.id) return;

    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(prefs),
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  }, [user?.id, getAuthHeaders]);

  // Refetch user data
  const refetch = useCallback(async () => {
    await initUser();
  }, [initUser]);

  return {
    userData,
    isLoading: isLoading || authLoading,
    isSynced,
    syncForums,
    syncAlerts,
    syncBookmarks,
    markAsRead,
    markAllAsRead,
    updatePreferences,
    refetch,
  };
}
