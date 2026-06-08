'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDataSync } from '@/components/DataSyncProvider';

export type Density = 'compact' | 'standard' | 'cozy';

const DENSITY_KEY = 'discuss-watch-density';
const DEFAULT: Density = 'standard';
const VALID: Density[] = ['compact', 'standard', 'cozy'];

function getStoredDensity(): Density {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const stored = localStorage.getItem(DENSITY_KEY);
    if (stored && (VALID as string[]).includes(stored)) return stored as Density;
    return DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useDensity() {
  // Fixed default so SSR and the first client render agree; the stored value is
  // read post-mount (reading localStorage during render causes a hydration mismatch).
  const [density, setDensityState] = useState<Density>(DEFAULT);
  const { serverData, syncDensity } = useDataSync();
  const hydratedRef = useRef(false);

  // Adopt the persisted density after hydration.
  useEffect(() => {
    setDensityState(getStoredDensity());
  }, []);

  // Apply data-density attribute to <html> whenever density changes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  // Hydrate from server on first arrival of serverData (cross-device sync).
  // Prefer server value when authenticated and localStorage is at the default.
  useEffect(() => {
    if (!serverData || hydratedRef.current) return;
    hydratedRef.current = true;
    const serverDensity = serverData.preferences?.density;
    if (serverDensity && (VALID as string[]).includes(serverDensity) && serverDensity !== density) {
      setDensityState(serverDensity as Density);
      try { localStorage.setItem(DENSITY_KEY, serverDensity); } catch { /* ignore */ }
    }
  }, [serverData, density]);

  const setDensity = useCallback((next: Density) => {
    if (!(VALID as string[]).includes(next)) return;
    setDensityState(next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch { /* ignore */ }
    if (hydratedRef.current && syncDensity) {
      syncDensity(next);
    }
  }, [syncDensity]);

  return { density, setDensity };
}
