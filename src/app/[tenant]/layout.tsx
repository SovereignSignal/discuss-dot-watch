import type { Metadata } from 'next';

// Dynamic metadata: tries to fetch tenant name, falls back to capitalizing slug
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;

  // Skip DB lookup for reserved slugs and invalid formats
  const isValidSlug = /^[a-z0-9][a-z0-9-]*$/.test(slug) && slug.length <= 64;

  let tenantName: string | null = null;
  if (isValidSlug) {
    try {
      // Dynamic import to avoid bundling DB deps in the client
      const { getTenantBySlug } = await import('@/lib/delegates/db');
      const tenant = await getTenantBySlug(slug);
      if (tenant) tenantName = tenant.name;
    } catch {
      // DB unavailable — fall through to slug-based title
    }
  }

  const displayName = tenantName || (isValidSlug
    ? slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'discuss.watch');

  return {
    title: `${displayName} — discuss.watch Delegate Dashboard`,
    description: `Delegate activity monitoring for ${displayName} governance forum.`,
  };
}

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
