/**
 * Cron endpoint for the Daily Brief (roles + grants in one email).
 *
 * Kept at its historical path so any external pinger keeps working, but
 * the in-process scheduler (lib/dailyBriefLoop.ts) is the primary trigger —
 * claimOncePerDay makes the two race-safe.
 *
 * GET /api/cron/grants-brief
 * Protected by CRON_SECRET (constant-time comparison).
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/auth';
import { runDailyBrief } from '@/lib/dailyBrief';

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyBrief();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron DailyBrief] Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
