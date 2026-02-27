import { NextResponse } from 'next/server';
import { isDatabaseConfigured, getDb } from '@/lib/db';
import { isRedisConfigured } from '@/lib/redis';

/**
 * GET /api/health - Unauthenticated health check for uptime monitoring
 */
export async function GET() {
  const checks: Record<string, string> = {};

  // DB check
  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      await db`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }
  } else {
    checks.database = 'not_configured';
  }

  // Redis check
  if (isRedisConfigured()) {
    checks.redis = 'ok';
  } else {
    checks.redis = 'not_configured';
  }

  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'not_configured');

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks },
    { status: allOk ? 200 : 503 },
  );
}
