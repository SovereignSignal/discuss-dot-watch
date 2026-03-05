'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface TenantRoles {
  isSuperAdmin: boolean;
  tenantSlugs: string[];
  isLoading: boolean;
  canAdminTenant: (slug: string) => boolean;
}

export function useTenantRoles(): TenantRoles {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tenantSlugs, setTenantSlugs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsSuperAdmin(false);
      setTenantSlugs([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;

        const res = await fetch('/api/user/tenant-roles', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (cancelled) return;

        setIsSuperAdmin(data.isSuperAdmin ?? false);
        setTenantSlugs(data.tenantSlugs ?? []);
      } catch {
        // Silent fail — user just won't see admin controls
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, getAccessToken]);

  const canAdminTenant = useCallback(
    (slug: string) => isSuperAdmin || tenantSlugs.includes(slug),
    [isSuperAdmin, tenantSlugs]
  );

  return { isSuperAdmin, tenantSlugs, isLoading, canAdminTenant };
}
