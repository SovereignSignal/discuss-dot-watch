'use client';

import { useCallback, useState } from 'react';
import {
  clearAdminToken,
  getAdminAuthHeaders,
  getAdminToken,
  setAdminToken as persistAdminToken,
} from '@/lib/adminToken';

export function useAdminToken() {
  const [token, setTokenState] = useState<string | null>(() => getAdminToken());

  const setToken = useCallback((next: string) => {
    const trimmed = next.trim();
    persistAdminToken(trimmed);
    setTokenState(trimmed);
  }, []);

  const clearToken = useCallback(() => {
    clearAdminToken();
    setTokenState(null);
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    return getAdminAuthHeaders();
  }, [token]);

  return {
    token,
    hasToken: !!token,
    setToken,
    clearToken,
    getAuthHeaders,
  };
}
