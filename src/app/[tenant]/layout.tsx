import type { Metadata } from 'next';
import type { TenantBranding } from '@/types/delegates';
import { notFound } from 'next/navigation';

// Dynamic metadata: tries to fetch tenant name + branding, 404s if tenant doesn't exist
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;

  // Invalid slug format — no tenant can match
  const isValidSlug = /^[a-z0-9][a-z0-9-]*$/.test(slug) && slug.length <= 64;
  if (!isValidSlug) {
    notFound();
  }

  let tenantName: string | null = null;
  let branding: TenantBranding | undefined;
  let dbReachable = true;
  try {
    const { getTenantBySlug } = await import('@/lib/delegates/db');
    const tenant = await getTenantBySlug(slug);
    if (tenant) {
      tenantName = tenant.name;
      branding = tenant.config.branding;
    }
  } catch {
    // DB unavailable — fall through to client-side handling
    dbReachable = false;
  }

  // Tenant doesn't exist and DB confirmed it — 404
  if (dbReachable && !tenantName) {
    notFound();
  }

  const displayName = tenantName || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

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

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
