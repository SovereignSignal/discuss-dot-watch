import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://discuss.watch';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/terms`, lastModified: new Date('2026-02-27'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date('2026-02-27'), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const feedRoutes: MetadataRoute.Sitemap = ['all', 'crypto', 'ai', 'oss'].map(v => ({
    url: `${baseUrl}/feed/${v}.xml`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.5,
  }));

  // Try to include tenant dashboard URLs from DB
  let tenantRoutes: MetadataRoute.Sitemap = [];
  try {
    const { isDatabaseConfigured, getDb } = await import('@/lib/db');
    if (isDatabaseConfigured()) {
      const db = getDb();
      const tenants = await db`SELECT slug FROM delegate_tenants WHERE is_active = true`;
      tenantRoutes = tenants.map(t => ({
        url: `${baseUrl}/${t.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }));
    }
  } catch {
    // DB unavailable — skip tenant routes
  }

  return [...staticRoutes, ...feedRoutes, ...tenantRoutes];
}
