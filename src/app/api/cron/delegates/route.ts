/**
 * Cron endpoint for automated delegate data refresh.
 *
 * Iterates all active tenants, checks if a refresh is due based on
 * each tenant's `refreshIntervalHours` config (default 12h), and
 * triggers a refresh via the existing refreshEngine.
 *
 * Protected by CRON_SECRET (constant-time comparison).
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { getAllTenants } from '@/lib/delegates/db';
import { refreshTenant } from '@/lib/delegates/refreshEngine';
import type { RefreshResult, DelegateTenant } from '@/types/delegates';

function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV === 'development') {
    return true;
  }

  if (!authHeader || !cronSecret) return false;

  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

function isRefreshDue(tenant: DelegateTenant): boolean {
  if (!tenant.lastRefreshAt) return true;

  const intervalHours = tenant.config?.refreshIntervalHours ?? 12;
  const lastRefresh = new Date(tenant.lastRefreshAt).getTime();
  const elapsed = Date.now() - lastRefresh;
  return elapsed >= intervalHours * 60 * 60 * 1000;
}

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const tenants = await getAllTenants();
  const activeTenants = tenants.filter((t) => t.isActive);

  const results: RefreshResult[] = [];
  const skippedDetails: Array<{ slug: string; reason: string }> = [];

  for (const tenant of activeTenants) {
    if (!isRefreshDue(tenant)) {
      skippedDetails.push({ slug: tenant.slug, reason: 'Not due yet' });
      continue;
    }

    try {
      console.log(`[Cron Delegates] Refreshing ${tenant.slug}...`);
      const result = await refreshTenant(tenant.slug);
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Cron Delegates] Error refreshing ${tenant.slug}:`, message);
      skippedDetails.push({ slug: tenant.slug, reason: message });
    }
  }

  console.log(
    `[Cron Delegates] Done: ${results.length} refreshed, ${skippedDetails.length} skipped`
  );

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    refreshed: results.length,
    skipped: skippedDetails.length,
    results,
    skippedDetails,
  });
}
