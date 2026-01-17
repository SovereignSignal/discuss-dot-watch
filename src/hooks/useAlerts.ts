'use client';

import { useState, useCallback } from 'react';
import { KeywordAlert } from '@/types';
import { getAlerts, addAlert as addAlertToStorage, removeAlert as removeAlertFromStorage, toggleAlert as toggleAlertInStorage } from '@/lib/storage';

export function useAlerts() {
  const [alerts, setAlerts] = useState<KeywordAlert[]>(() => {
    if (typeof window === 'undefined') return [];
    return getAlerts();
  });
  const [isHydrated, setIsHydrated] = useState(false);

  if (typeof window !== 'undefined' && !isHydrated) {
    setAlerts(getAlerts());
    setIsHydrated(true);
  }

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

  const enabledAlerts = alerts.filter(a => a.isEnabled);

  return {
    alerts,
    enabledAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
  };
}
