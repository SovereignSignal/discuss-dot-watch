'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDataSync } from '@/components/DataSyncProvider';

type Theme = 'dark' | 'light';

const THEME_KEY = 'discuss-watch-theme';

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return (stored as Theme) || 'dark';
  } catch {
    return 'dark';
  }
}

export function useTheme() {
  // Initialize to a fixed default so SSR and the first client render agree (reading
  // localStorage here would diverge from the server and cause a hydration mismatch).
  const [theme, setThemeState] = useState<Theme>('dark');
  const didApply = useRef(false);
  const hydratedRef = useRef(false);
  const { serverData, syncTheme } = useDataSync();

  // Adopt the persisted theme after hydration.
  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!serverData || hydratedRef.current) return;
    hydratedRef.current = true;
    const serverTheme = serverData.preferences?.theme;
    if ((serverTheme === 'dark' || serverTheme === 'light') && serverTheme !== theme) {
      setThemeState(serverTheme);
      try { localStorage.setItem(THEME_KEY, serverTheme); } catch { /* storage monitor reports writes */ }
    }
  }, [serverData, theme]);

  // Keep the <html> theme class in sync on change. Skip the first run: the
  // pre-hydration inline script in the root layout already set the correct class,
  // and re-applying the 'dark' default here would clobber it and cause a flash.
  useEffect(() => {
    if (!didApply.current) {
      didApply.current = true;
      return;
    }
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme !== 'light');
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(THEME_KEY, newTheme); } catch { /* storage monitor reports writes */ }
      // Dispatch custom event so AuthProvider can update Privy theme
      window.dispatchEvent(new Event('themechange'));
    }
    if (hydratedRef.current) syncTheme(newTheme);
  }, [syncTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  };
}
