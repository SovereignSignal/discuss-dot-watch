import { cache } from 'react';
import { isValidTenantSlug } from '@/lib/tenantSlug';

export const lookupTenant = cache(async (slug: string) => {
  if (!isValidTenantSlug(slug)) return { valid: false as const };
  try {
    const { getTenantBySlug } = await import('@/lib/delegates/db');
    const tenant = await getTenantBySlug(slug);
    return { valid: true as const, tenant };
  } catch {
    // DB unavailable — let client-side handle it
    return { valid: true as const, tenant: null, dbDown: true as const };
  }
});
