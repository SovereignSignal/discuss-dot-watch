import { cache } from 'react';

export const VALID_SLUG = /^[a-z0-9][a-z0-9-]*$/;

export const lookupTenant = cache(async (slug: string) => {
  if (!VALID_SLUG.test(slug) || slug.length > 64) return { valid: false as const };
  try {
    const { getTenantBySlug } = await import('@/lib/delegates/db');
    const tenant = await getTenantBySlug(slug);
    return { valid: true as const, tenant };
  } catch {
    // DB unavailable — let client-side handle it
    return { valid: true as const, tenant: null, dbDown: true as const };
  }
});
