/**
 * GET /api/anticapture
 * List of DAOs Anticapture supports (governance params + flags).
 */
import { NextResponse } from 'next/server';
import { isAnticaptureConfigured, getDaos } from '@/lib/delegates/anticaptureClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAnticaptureConfigured()) {
    return NextResponse.json({ configured: false, daos: [] });
  }
  try {
    const daos = await getDaos();
    return NextResponse.json({ configured: true, daos });
  } catch (e) {
    return NextResponse.json(
      { configured: true, daos: [], error: e instanceof Error ? e.message : 'fetch failed' },
      { status: 502 },
    );
  }
}
