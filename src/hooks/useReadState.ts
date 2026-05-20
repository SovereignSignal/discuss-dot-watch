'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDataSync } from '@/components/DataSyncProvider';

const STORAGE_KEY = 'discuss-watch-read-discussions';
const MAX_STORED_ITEMS = 1000; // Limit storage size

interface ReadState {
  [refId: string]: number; // timestamp when marked as read
}

function getReadState(): ReadState {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    console.warn('Failed to parse read state from storage');
    return {};
  }
}

function saveReadState(state: ReadState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Prune old entries if we exceed the limit
    const entries = Object.entries(state);
    let toSave = state;
    if (entries.length > MAX_STORED_ITEMS) {
      // Keep only the most recent entries
      const sorted = entries.sort((a, b) => b[1] - a[1]);
      toSave = Object.fromEntries(sorted.slice(0, MAX_STORED_ITEMS));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    return true;
  } catch (e) {
    // Storage full or unavailable - log but don't crash
    if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
      console.warn('Storage quota exceeded when saving read state');
    }
    return false;
  }
}

export function useReadState() {
  const [readState, setReadState] = useState<ReadState>(() => getReadState());
  const { serverData, markAsRead: syncMarkAsRead, markAllAsRead: syncMarkAllAsRead } = useDataSync();
  const hydratedRef = useRef(false);

  // Hydrate from server on first arrival of serverData (cross-device sync)
  useEffect(() => {
    if (!serverData || hydratedRef.current) return;
    hydratedRef.current = true;

    const server = serverData.readState || {};
    const serverIds = Object.keys(server);
    const localIds = Object.keys(readState);

    if (serverIds.length === 0 && localIds.length === 0) return;

    // Union: keep the more recent timestamp per refId
    const merged: ReadState = { ...readState };
    let changed = false;
    for (const id of serverIds) {
      const serverTs = server[id];
      const localTs = merged[id];
      if (!localTs || serverTs > localTs) {
        merged[id] = serverTs;
        changed = true;
      }
    }
    if (changed) {
      setReadState(merged);
      saveReadState(merged);
    }
    // Push any local-only refIds to server
    const localOnly = localIds.filter((id) => !(id in server));
    if (localOnly.length > 0) {
      syncMarkAllAsRead(localOnly);
    }
  }, [serverData, readState, syncMarkAllAsRead]);

  const markAsRead = useCallback((refId: string) => {
    setReadState((prev) => {
      const updated = { ...prev, [refId]: Date.now() };
      saveReadState(updated);
      return updated;
    });
    if (hydratedRef.current) {
      syncMarkAsRead(refId);
    }
  }, [syncMarkAsRead]);

  const markMultipleAsRead = useCallback((refIds: string[]) => {
    setReadState((prev) => {
      const now = Date.now();
      const updated = { ...prev };
      refIds.forEach((refId) => {
        updated[refId] = now;
      });
      saveReadState(updated);
      return updated;
    });
    if (hydratedRef.current && refIds.length > 0) {
      syncMarkAllAsRead(refIds);
    }
  }, [syncMarkAllAsRead]);

  const isRead = useCallback(
    (refId: string): boolean => {
      return refId in readState;
    },
    [readState]
  );

  const getUnreadCount = useCallback(
    (refIds: string[]): number => {
      return refIds.filter((refId) => !readState[refId]).length;
    },
    [readState]
  );

  const clearReadState = useCallback(() => {
    setReadState({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    isRead,
    markAsRead,
    markMultipleAsRead,
    getUnreadCount,
    clearReadState,
    readCount: Object.keys(readState).length,
  };
}
