import type { Metadata } from 'next';
import type { TenantBranding } from '@/types/delegates';
import { notFound } from 'next/navigation';

const VALID_SLUG = /^[a-z0-9][a-z0-9-]*$/;

async function lookupTenant(slug: string) {
  if (!VALID_SLUG.test(slug) || slug.length > 64) return { valid: false as const };
  try {
    const { getTenantBySlug } = await import('@/lib/delegates/db');
    const tenant = await getTenantBySlug(slug);
    return { valid: true as const, tenant };
  } catch {
    // DB unavailable — let client-side handle it
    return { valid: true as const, tenant: null, dbDown: true };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const result = await lookupTenant(slug);

  let tenantName: string | null = null;
  let branding: TenantBranding | undefined;

  if (result.valid && result.tenant) {
    tenantName = result.tenant.name;
    branding = result.tenant.config.branding;
  }

  const displayName = tenantName
    || (VALID_SLUG.test(slug) ? slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'discuss.watch');

  const title = branding?.heroTitle
    ? `${displayName} — Community Dashboard`
    : `${displayName} — discuss.watch Delegate Dashboard`;

  const description = branding?.heroSubtitle
    || `Delegate activity monitoring for ${displayName} governance forum.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://discuss.watch/${slug}`,
      siteName: 'discuss.watch',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function TenantLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: React.ReactNode;
}) {
  const { tenant: slug } = await params;
  const result = await lookupTenant(slug);

  // Invalid slug format — no tenant can match
  if (!result.valid) notFound();

  // DB confirmed tenant doesn't exist (skip if DB is unreachable)
  if (!result.dbDown && !result.tenant) notFound();

  return children;
}
