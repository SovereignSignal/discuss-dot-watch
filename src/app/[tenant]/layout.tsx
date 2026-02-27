import type { Metadata } from 'next';
import type { TenantBranding } from '@/types/delegates';
import { lookupTenant, VALID_SLUG } from './tenantLookup';

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

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
