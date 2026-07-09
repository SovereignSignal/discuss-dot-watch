/**
 * GET /api/v1/grants
 * Public, CORS-enabled feed of classified grants & funding items.
 *
 * Built for machine consumers (e.g. the Grant Wire's WireOps ingester):
 * items ship with classification (GRANT/NEWS/NOISE), confidence, and
 * extracted fields, and `since` on first_seen_at gives a clean watermark.
 *
 * Query params:
 * - since: ISO date — only items first seen after this (watermark)
 * - wire: 'crypto' | 'ai' | 'oss'
 * - classification: 'GRANT' (default) | 'ROLE' | 'NEWS' | 'NOISE' | 'all'
 *   (ROLE = paid governance positions; a separate lane. Neither the default
 *   NOR 'all' ever includes ROLE — 'all' means the wire classes
 *   GRANT+NEWS+NOISE, preserving its pre-ROLE meaning for existing
 *   consumers. ROLE items require classification=ROLE explicitly.)
 * - min_confidence: 0-100 (default 0)
 * - status: filter on extracted lifecycle status (e.g. 'open')
 * - limit: max items (default 50, max 100)
 * - cursor: paginate with the `nextCursor` from a previous response
 */

import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { withCors, corsOptions } from '@/lib/cors';
import { queryGrantsItems, GrantsItemRow } from '@/lib/grantsStore';
import { isDatabaseConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

function toPublicItem(row: GrantsItemRow) {
  return {
    id: row.id,
    refId: row.topic_ref_id,
    // scan_entries-compatible core fields
    name: row.program || row.title,
    description: [
      row.kind ? `${row.kind}` : null,
      row.amount_max != null
        ? `${row.amount_min != null && row.amount_min !== row.amount_max ? `${row.amount_min}–` : ''}${row.amount_max} ${row.currency || ''}`.trim()
        : null,
      // postgres.js returns timestamptz as Date — format ISO, not Date.toString()
      row.deadline ? `deadline ${(row.deadline instanceof Date ? row.deadline.toISOString() : String(row.deadline)).slice(0, 10)}` : null,
    ].filter(Boolean).join(' · ') || null,
    url: row.url,
    wire: row.vertical,
    sourceType: 'discuss_watch_forum',
    // full detail
    title: row.title,
    protocol: row.protocol,
    forumUrl: row.forum_url,
    classification: row.classification,
    kind: row.kind,
    confidence: row.confidence,
    program: row.program,
    amountMin: row.amount_min != null ? Number(row.amount_min) : null,
    amountMax: row.amount_max != null ? Number(row.amount_max) : null,
    currency: row.currency,
    deadline: row.deadline,
    chain: row.chain,
    status: row.status,
    applyUrl: row.apply_url,
    signal: row.signal,
    excerpt: row.first_post_text || null,
    engagement: { replies: row.replies, views: row.views, likes: row.likes },
    topicCreatedAt: row.topic_created_at,
    lastActivityAt: row.last_activity_at,
    firstSeenAt: row.first_seen_at,
  };
}

export function OPTIONS() { return corsOptions(); }

export async function GET(request: Request) {
  const ip = getRateLimitKey(request);
  const rateLimit = checkRateLimit(`v1:grants:${ip}`, { windowMs: 60000, maxRequests: 30 });
  if (!rateLimit.allowed) {
    return withCors(NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString() } },
    ));
  }

  if (!isDatabaseConfigured()) {
    return withCors(NextResponse.json({ items: [], meta: { configured: false } }));
  }

  const { searchParams } = new URL(request.url);

  const since = searchParams.get('since') || undefined;
  if (since && Number.isNaN(new Date(since).getTime())) {
    return withCors(NextResponse.json({ error: 'Invalid since date' }, { status: 400 }));
  }

  const wireParam = searchParams.get('wire');
  const wire = wireParam === 'crypto' || wireParam === 'ai' || wireParam === 'oss' ? wireParam : undefined;

  const classParam = (searchParams.get('classification') || 'GRANT').toUpperCase();
  // 'all' keeps its pre-ROLE meaning (the wire classes) so existing
  // consumers like the Grant Wire can never receive ROLE items without
  // naming them explicitly — roles are a separate lane by design.
  const WIRE_CLASSES = ['GRANT', 'NEWS', 'NOISE'];
  const classifications = classParam === 'ALL' ? WIRE_CLASSES : [classParam];
  if (classParam !== 'ALL' && !['GRANT', 'ROLE', 'NEWS', 'NOISE'].includes(classParam)) {
    return withCors(NextResponse.json({ error: 'Invalid classification' }, { status: 400 }));
  }

  const minConfParam = parseInt(searchParams.get('min_confidence') ?? '0', 10);
  const minConfidence = Number.isFinite(minConfParam) ? Math.max(0, Math.min(100, minConfParam)) : 0;

  const status = searchParams.get('status') || undefined;

  const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50, 100);

  const cursorParam = searchParams.get('cursor');
  const cursor = cursorParam != null ? parseInt(cursorParam, 10) : undefined;
  if (cursorParam != null && !Number.isFinite(cursor)) {
    return withCors(NextResponse.json({ error: 'Invalid cursor' }, { status: 400 }));
  }

  try {
    const rows = await queryGrantsItems({
      since, wire, minConfidence, classifications, status, limit, cursor,
    });
    return withCors(NextResponse.json({
      items: rows.map(toPublicItem),
      meta: {
        count: rows.length,
        nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
      },
    }));
  } catch (error) {
    console.error('[API v1/grants] Query failed:', error);
    return withCors(NextResponse.json({ error: 'Internal error' }, { status: 500 }));
  }
}
