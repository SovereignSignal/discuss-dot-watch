'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import type { Forum } from '@/types';

interface DataSyncContextType {
  isAuthenticated: boolean;
  userId: string | null;
  syncForums: (forums: Forum[]) => void;
  syncAlerts: (alerts: { keyword: string; isEnabled: boolean }[]) => void;
  syncBookmarks: (bookmarks: { topicRefId: string; topicTitle: string; topicUrl: string; protocol: string; folder?: string | null }[]) => void;
  markAsRead: (topicRefId: string) => void;
  markAllAsRead: (topicRefIds: string[]) => void;
  syncTheme: (theme: 'dark' | 'light') => void;
  syncDensity: (density: 'compact' | 'standard' | 'cozy') => void;
  syncOnboarding: (completed: boolean) => void;
  migrateLocalData: () => Promise<void>;
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

const noop = () => {};
const asyncNoop = async () => {};

/**
 * Local-only data layer. Preferences live in the browser; there is no
 * account sync now that authentication has been removed.
 */
export function DataSyncProvider({ children }: { children: ReactNode }) {
  const value: DataSyncContextType = useMemo(() => ({
    isAuthenticated: false,
    userId: null,
    syncForums: noop,
    syncAlerts: noop,
    syncBookmarks: noop,
    markAsRead: noop,
    markAllAsRead: noop,
    syncTheme: noop,
    syncDensity: noop,
    syncOnboarding: noop,
    migrateLocalData: asyncNoop,
    serverData: null,
    isLoadingServerData: false,
  }), []);

  return (
    <DataSyncContext.Provider value={value}>
      {children}
    </DataSyncContext.Provider>
  );
}
