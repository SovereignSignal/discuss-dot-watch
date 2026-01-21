'use client';

import { useState, useCallback, useMemo } from 'react';
import { KeywordAlert } from '@/types';
import { getAlerts, addAlert as addAlertToStorage, removeAlert as removeAlertFromStorage, toggleAlert as toggleAlertInStorage } from '@/lib/storage';

export function useAlerts() {
  // Use lazy initialization - this runs only on client after hydration
  const [alerts, setAlerts] = useState<KeywordAlert[]>(() => {
    // Only access localStorage on client side
    if (typeof window === 'undefined') return [];
    return getAlerts();
  });

  const addAlert = useCallback((keyword: string) => {
    const newAlert = addAlertToStorage(keyword);
    setAlerts(prev => [...prev, newAlert]);
    return newAlert;
  }, []);

  const removeAlert = useCallback((id: string) => {
    const success = removeAlertFromStorage(id);
    if (success) {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }
    return success;
  }, []);

  const toggleAlert = useCallback((id: string) => {
    const updated = toggleAlertInStorage(id);
    if (updated) {
      setAlerts(prev => prev.map(a => a.id === id ? updated : a));
    }
    return updated;
  }, []);

  // Memoize derived state to prevent unnecessary recalculations
  const enabledAlerts = useMemo(() => alerts.filter(a => a.isEnabled), [alerts]);

  return {
    alerts,
    enabledAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
  };
}
