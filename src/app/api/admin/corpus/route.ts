import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminAuth, isAuthError } from '@/lib/auth';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { CorpusError } from '@/lib/corpusPolicy';
import { initializeCorpusSchema, startCorpusJob, corpusStatus, pauseCorpusJob, resumeCorpusJob, extendCorpusJob } from '@/lib/corpusStore';
import { runCorpusTick } from '@/lib/corpusWorker';
import { classifyCorpusTopic } from '@/lib/corpusClassifier';
import { initializeCorpusPromotionSchema, promoteCorpusTopic, withdrawCorpusPromotion } from '@/lib/corpusPromotion';
import { corpusSchemaState } from '@/lib/corpusReadiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const source = z.string().min(3).max(300);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('initialize') }),
  z.object({ action: z.literal('start'), source, days: z.union([z.literal(7), z.literal(30), z.literal(180)]), asOf: z.string().datetime(),maxTopics:z.number().int().min(1).max(2000).optional(),maxPages:z.number().int().min(1).max(200).optional() }),
  z.object({action:z.literal('extend'),jobId:z.string().uuid(),maxTopics:z.number().int().min(1).max(2000),maxPages:z.number().int().min(1).max(200)}),
  z.object({ action: z.literal('tick'), jobId: z.string().uuid() }),
  z.object({ action: z.literal('pause'), jobId: z.string().uuid() }),
  z.object({ action: z.literal('resume'), jobId: z.string().uuid() }),
  z.object({ action: z.literal('classify'), topicId: z.number().int().positive(), lane: z.enum(['funding','opportunities']) }),
  z.object({ action: z.literal('promote'), topicId: z.number().int().positive(), lane: z.enum(['funding','opportunities']) }),
  z.object({ action: z.literal('withdraw'), topicId: z.number().int().positive(), lane: z.enum(['funding','opportunities']) }),
]);
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const upgradeRequired = () => json({ error: 'corpus_upgrade_required', upgradeRequired: true, requiredAction: 'initialize' }, 409);
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) return json({ error: auth.error }, auth.status);
  try {
    if ((await corpusSchemaState()).upgradeRequired) return upgradeRequired();
    return json(await corpusStatus());
  } catch { return json({ error: 'corpus_status_failed' }, 503); }
}
export async function POST(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (isAuthError(auth)) return json({ error: auth.error }, auth.status);
  const rate = checkRateLimit(`admin:corpus:${getRateLimitKey(request)}`, { windowMs: 60_000, maxRequests: 20 });
  if (!rate.allowed) return json({ error: 'rate_limited' }, 429);
  try {
    if (Number(request.headers.get('content-length') || 0) > 4096) return json({ error: 'request_too_large' }, 413);
    const body = await request.text();
    if (body.length > 4096) return json({ error: 'request_too_large' }, 413);
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { return json({ error: 'invalid_json' }, 400); }
    const input = schema.safeParse(parsed);
    if (!input.success) return json({ error: 'invalid_request' }, 400);
    const data = input.data;
    if (data.action !== 'initialize' && (await corpusSchemaState()).upgradeRequired) return upgradeRequired();
    switch (data.action) {
      case 'initialize': await initializeCorpusSchema(); await initializeCorpusPromotionSchema(); return json({ initialized: true });
      case 'start': return json({ jobId: await startCorpusJob(data.source, data.days, data.asOf,{maxTopics:data.maxTopics,maxPages:data.maxPages}), notify: false });
      case 'extend':return json(await extendCorpusJob(data.jobId,data.maxTopics,data.maxPages));
      case 'tick': return json(await runCorpusTick(data.jobId));
      case 'pause': await pauseCorpusJob(data.jobId); return json({ paused: true });
      case 'resume': await resumeCorpusJob(data.jobId); return json({ resumed: true });
      case 'classify': return json(await classifyCorpusTopic(data.topicId, data.lane));
      case 'promote': return json(await promoteCorpusTopic(data.topicId, data.lane));
      case 'withdraw': return json(await withdrawCorpusPromotion(data.topicId, data.lane));
    }
  } catch (error) {
    return json({ error: error instanceof CorpusError ? error.code : 'corpus_operation_failed' }, error instanceof CorpusError ? 422 : 503);
  }
}
