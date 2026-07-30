/**
 * Single source of truth for the multi-tenant (delegates) slug format.
 * Used by the proxy, the [tenant] layout/lookup, and every /api/delegates/[tenant]/* route,
 * which previously each inlined similar regexes. Keep this in one place so the rule can't drift.
 *
 * Matches the admin create-tenant Zod schema:
 *   - 1-100 characters
 *   - starts with a letter or number
 *   - letters, numbers, dashes, and underscores allowed
 */
const TENANT_SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;

/** Marketing/static slugs that should 404 before any tenant DB lookup. */
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'feed', 'governance', 'invite', 'privacy', 'terms',
  'about', 'contact', 'pricing', 'help', 'docs', 'blog', 'login', 'signup',
  'settings', 'sitemap.xml', 'robots.txt', 'icon.svg',
]);

export function isValidTenantSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && TENANT_SLUG_RE.test(slug);
}
