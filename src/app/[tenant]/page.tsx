import { notFound } from 'next/navigation';
import { lookupTenant } from './tenantLookup';
import TenantDashboardPage from './DashboardClient';

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const result = await lookupTenant(slug);

  // Invalid slug format — no tenant can match
  if (!result.valid) notFound();

  // DB confirmed tenant doesn't exist (skip if DB is unreachable)
  if (!result.dbDown && !result.tenant) notFound();

  return <TenantDashboardPage />;
}
