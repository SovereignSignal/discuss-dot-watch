import type { Metadata } from 'next';

// Dynamic metadata: tries to fetch tenant name, falls back to capitalizing slug
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;

  let tenantName: string | null = null;
  try {
    // Dynamic import to avoid bundling DB deps in the client
    const { getTenantBySlug } = await import('@/lib/delegates/db');
    const tenant = await getTenantBySlug(slug);
    if (tenant) tenantName = tenant.name;
  } catch {
    // DB unavailable — fall through to slug-based title
  }

  const displayName = tenantName || slug.charAt(0).toUpperCase() + slug.slice(1);

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
