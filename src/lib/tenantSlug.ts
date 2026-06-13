/**
 * Single source of truth for the multi-tenant (delegates) slug format.
 * Used by the [tenant] embed page and every /api/delegates/[tenant]/* route, which
 * previously each inlined the same regex. Keep this in one place so the rule can't drift.
 */
const TENANT_SLUG_RE = /^[a-zA-Z0-9_-]{1,100}$/;

export function isValidTenantSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && TENANT_SLUG_RE.test(slug);
}
