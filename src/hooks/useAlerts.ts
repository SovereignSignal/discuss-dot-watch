'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { KeywordAlert } from '@/types';
import { getAlerts, saveAlerts, addAlert as addAlertToStorage, removeAlert as removeAlertFromStorage, toggleAlert as toggleAlertInStorage } from '@/lib/storage';
import { useDataSync } from '@/components/DataSyncProvider';

export function useAlerts() {
  // Use lazy initialization - this runs only on client after hydration
  const [alerts, setAlerts] = useState<KeywordAlert[]>(() => {
    // Only access localStorage on client side
    if (typeof window === 'undefined') return [];
    return getAlerts();
  });
  const { serverData, syncAlerts } = useDataSync();
  const hydratedRef = useRef(false);

  // Hydrate from server on first arrival of serverData (cross-device sync)
  useEffect(() => {
    if (!serverData || hydratedRef.current) return;
    hydratedRef.current = true;

    const local = alerts;
    const server: KeywordAlert[] = serverData.alerts.map((a) => ({
      id: String(a.id),
      keyword: a.keyword,
      isEnabled: a.isEnabled,
      createdAt: a.createdAt,
    }));

    if (local.length === 0 && server.length > 0) {
      setAlerts(server);
      saveAlerts(server);
    } else if (local.length > 0 && server.length === 0) {
      syncAlerts(local);
    } else if (local.length > 0 && server.length > 0) {
      const localKeywords = new Set(local.map((a) => a.keyword.toLowerCase()));
      const merged = [...local, ...server.filter((a) => !localKeywords.has(a.keyword.toLowerCase()))];
      if (merged.length !== local.length) {
        setAlerts(merged);
        saveAlerts(merged);
        syncAlerts(merged);
      }
    }
  }, [serverData, alerts, syncAlerts]);

  const persistAndSync = useCallback((updated: KeywordAlert[]) => {
    saveAlerts(updated);
    if (hydratedRef.current) {
      syncAlerts(updated);
    }
  }, [syncAlerts]);

  const addAlert = useCallback((keyword: string) => {
    const newAlert = addAlertToStorage(keyword);
    setAlerts(prev => {
      const updated = [...prev, newAlert];
      if (hydratedRef.current) syncAlerts(updated);
      return updated;
    });
    return newAlert;
  }, [syncAlerts]);

  const removeAlert = useCallback((id: string) => {
    const success = removeAlertFromStorage(id);
    if (success) {
      setAlerts(prev => {
        const updated = prev.filter(a => a.id !== id);
        if (hydratedRef.current) syncAlerts(updated);
        return updated;
      });
    }
    return success;
  }, [syncAlerts]);

  const toggleAlert = useCallback((id: string) => {
    const updated = toggleAlertInStorage(id);
    if (updated) {
      setAlerts(prev => {
        const next = prev.map(a => a.id === id ? updated : a);
        if (hydratedRef.current) syncAlerts(next);
        return next;
      });
    }
    return updated;
  }, [syncAlerts]);

  const importAlerts = useCallback((newAlerts: KeywordAlert[], replace = false) => {
    if (replace) {
      setAlerts(newAlerts);
      persistAndSync(newAlerts);
    } else {
      // Merge: add alerts that don't already exist (by keyword)
      setAlerts(prev => {
        const existingKeywords = new Set(prev.map(a => a.keyword.toLowerCase()));
        const toAdd = newAlerts.filter(a => !existingKeywords.has(a.keyword.toLowerCase()));
        const merged = [...prev, ...toAdd];
        persistAndSync(merged);
        return merged;
      });
    }
  }, [persistAndSync]);

  // Memoize derived state to prevent unnecessary recalculations
  const enabledAlerts = useMemo(() => alerts.filter(a => a.isEnabled), [alerts]);

  return {
    alerts,
    enabledAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
    importAlerts,
  };
}
