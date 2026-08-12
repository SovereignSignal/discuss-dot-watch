'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAdminToken } from '@/lib/adminToken';

interface TenantRoles {
  isSuperAdmin: boolean;
  tenantSlugs: string[];
  isLoading: boolean;
  canAdminTenant: (slug: string) => boolean;
}

export function useTenantRoles(): TenantRoles {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setIsSuperAdmin(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/admin', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setIsSuperAdmin(res.ok);
      } catch {
        if (!cancelled) setIsSuperAdmin(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const canAdminTenant = useCallback(
    (_slug: string) => isSuperAdmin,
    [isSuperAdmin],
  );

  return { isSuperAdmin, tenantSlugs: [], isLoading, canAdminTenant };
}
