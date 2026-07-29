'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { KeywordAlert } from '@/types';
import { getAlerts, saveAlerts } from '@/lib/storage';
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

  const persistAndSync = useCallback((updated: KeywordAlert[]): boolean => {
    if (!saveAlerts(updated)) return false;
    if (hydratedRef.current) {
      syncAlerts(updated);
    }
    return true;
  }, [syncAlerts]);

  const addAlert = useCallback((keyword: string) => {
    const newAlert: KeywordAlert = {
      id: crypto.randomUUID(),
      keyword: keyword.trim().slice(0, 100),
      createdAt: new Date().toISOString(),
      isEnabled: true,
    };
    const updated = [...alerts, newAlert];
    if (!persistAndSync(updated)) return null;
    setAlerts(updated);
    return newAlert;
  }, [alerts, persistAndSync]);

  const removeAlert = useCallback((id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    if (updated.length === alerts.length || !persistAndSync(updated)) return false;
    setAlerts(updated);
    return true;
  }, [alerts, persistAndSync]);

  const toggleAlert = useCallback((id: string) => {
    const current = alerts.find(a => a.id === id);
    if (!current) return null;
    const toggled = { ...current, isEnabled: !current.isEnabled };
    const updated = alerts.map(a => a.id === id ? toggled : a);
    if (!persistAndSync(updated)) return null;
    setAlerts(updated);
    return toggled;
  }, [alerts, persistAndSync]);

  const importAlerts = useCallback((newAlerts: KeywordAlert[], replace = false) => {
    if (replace) {
      if (persistAndSync(newAlerts)) setAlerts(newAlerts);
    } else {
      // Merge: add alerts that don't already exist (by keyword)
      setAlerts(prev => {
        const existingKeywords = new Set(prev.map(a => a.keyword.toLowerCase()));
        const toAdd = newAlerts.filter(a => !existingKeywords.has(a.keyword.toLowerCase()));
        const merged = [...prev, ...toAdd];
        return persistAndSync(merged) ? merged : prev;
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
