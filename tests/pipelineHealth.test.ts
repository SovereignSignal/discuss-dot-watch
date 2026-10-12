import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDailyBriefHtml, formatDailyBriefText, pipelineLines } from '@/lib/dailyBrief';
import { assessPipelineHealth, heldReason, type HeldRow, type PipelineStats } from '@/lib/pipelineHealth';
import { freshPolicyBlock, INTELLIGENCE_CLASSIFIER_VERSION } from '@/lib/intelligenceStore';

const now = Date.parse('2026-10-06T14:00:00Z');
const stats: PipelineStats = {
  lastScanAt: new Date(now - 6 * 60_000),
  newTopics: 412, judged: 37, failed: 0,
  actionable: { funding: 2, opportunities: 1 },
  published: { funding: 1, opportunities: 0 },
  sources: { enabled: 480, failing: 3, stale: 1 },
  classifierConfigured: true,
};

test('the footer reads as a funnel with scan recency and source health', () => {
  const lines = pipelineLines({ stats, health: { level: 'ok', reasons: [] } }, now);
  assert.equal(lines.funnel, '412 new topics → 37 judged → 3 actionable → 1 published');
  assert.equal(lines.detail, 'last scan 6 min ago · sources 476/480 ok, 3 failing, 1 stale · 0 classifier errors');
  assert.deepEqual(lines.warnings, []);
});

test('warnings only surface when the level is not ok', () => {
  const lines = pipelineLines({ stats, health: { level: 'degraded', reasons: ['No scan for 3 h'] } }, now);
  assert.deepEqual(lines.warnings, ['No scan for 3 h']);
});

test('a quiet day renders as a heartbeat, not an empty shell', () => {
  const brief = { date: new Date(now), roles: [], grants: [], summary: null, pipeline: { stats, health: { level: 'ok' as const, reasons: [] } } };
  const text = formatDailyBriefText(brief);
  assert.match(text, /PIPELINE — last 24h/);
  assert.match(text, /412 new topics/);
  assert.match(formatDailyBriefHtml(brief), /nothing new/);
});

test('reasons are escaped in the HTML part', () => {
  const brief = { date: new Date(now), roles: [], grants: [], summary: null, pipeline: { stats, health: { level: 'down' as const, reasons: ['<b>x</b>'] } } };
  const html = formatDailyBriefHtml(brief);
  assert.match(html, /Pipeline needs attention/);
  assert.ok(!html.includes('<b>x</b>'));
});

test('the 2026-10-07 production baseline is healthy, including a day with nothing published', () => {
  const prod: PipelineStats = { ...stats, newTopics: 1772, judged: 553, failed: 4, published: { funding: 0, opportunities: 0 },
    sources: { enabled: 363, failing: 0, stale: 5 } };
  assert.deepEqual(assessPipelineHealth(prod, now), { level: 'ok', reasons: [] });
});

test('a stalled scan, a dead classifier or silent sources are down', () => {
  assert.equal(assessPipelineHealth({ ...stats, lastScanAt: new Date(now - 3 * 3_600_000) }, now).reasons[0], 'No scan for 3 h (normally every 15 min)');
  assert.equal(assessPipelineHealth({ ...stats, lastScanAt: null }, now).level, 'down');
  assert.equal(assessPipelineHealth({ ...stats, judged: 0 }, now).reasons[0], '412 new topics but nothing judged in 24h');
  assert.equal(assessPipelineHealth({ ...stats, newTopics: 0 }, now).level, 'down');
  assert.equal(assessPipelineHealth({ ...stats, classifierConfigured: false }, now).level, 'down');
});

test('error rates and source rot degrade without crying wolf', () => {
  assert.equal(assessPipelineHealth({ ...stats, failed: 4, judged: 10 }, now).level, 'ok');      // below the floor
  assert.equal(assessPipelineHealth({ ...stats, failed: 6, judged: 553 }, now).level, 'ok');     // ~1%
  assert.deepEqual(assessPipelineHealth({ ...stats, failed: 40, judged: 360 }, now).reasons, ['40 classifier errors in 24h (10% of attempts)']);
  assert.equal(assessPipelineHealth({ ...stats, sources: { enabled: 363, failing: 12, stale: 5 } }, now).level, 'degraded');
  assert.equal(assessPipelineHealth({ ...stats, sources: { enabled: 363, failing: 0, stale: 40 } }, now).reasons[0], '40 of 363 sources stale');
});

test('an empty run before the heartbeat hour claims nothing (early cron pings cannot burn the day)', async (t) => {
  const prev = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL; // no items, and any claim attempt would throw
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-07T14:05:00Z') });
  try {
    const { runDailyBrief, HEARTBEAT_HOUR_UTC } = await import('@/lib/dailyBrief');
    assert.equal(HEARTBEAT_HOUR_UTC, 18);
    assert.deepEqual(await runDailyBrief(), { sent: false, roles: 0, grants: 0, reason: 'No new items' });
  } finally {
    t.mock.timers.reset();
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  }
});

const cutoverAt = new Date('2026-10-05T04:09:00Z');
const heldRow: HeldRow = {
  title: 'Round 9 grants open', lane: 'funding', evalHash: 'h', docHash: 'h', recordHash: 'h',
  hidden: false, closed: false, historical: false, sourceCreatedAt: new Date(now - 86_400_000),
  reviewState: 'pending', classifierVersion: INTELLIGENCE_CLASSIFIER_VERSION, confidence: 90, hasEvidence: true,
};

test('the fresh policy publishes only live, post-cutover sources under 30 days old', () => {
  const at = (ms: number) => new Date(now - ms);
  assert.equal(freshPolicyBlock({ historical: false, sourceCreatedAt: at(86_400_000), cutoverAt }, now), null);
  assert.equal(freshPolicyBlock({ historical: true, sourceCreatedAt: at(86_400_000), cutoverAt }, now), 'first seen over 48h after posting');
  assert.equal(freshPolicyBlock({ historical: false, sourceCreatedAt: null, cutoverAt }, now), 'no creation date');
  assert.equal(freshPolicyBlock({ historical: false, sourceCreatedAt: new Date('2026-10-01T00:00:00Z'), cutoverAt }, now), 'posted before the Oct 5 cutover');
  assert.equal(freshPolicyBlock({ historical: false, sourceCreatedAt: at(86_400_000), cutoverAt: null }, now), 'posted before the Oct 5 cutover');
  const later = Date.parse('2026-11-20T00:00:00Z');
  assert.equal(freshPolicyBlock({ historical: false, sourceCreatedAt: new Date('2026-10-20T23:59:00Z'), cutoverAt }, later), 'over 30 days old');
  assert.equal(freshPolicyBlock({ historical: false, sourceCreatedAt: new Date('2026-10-21T00:01:00Z'), cutoverAt }, later), null);
});

test('a held item reports the first gate rule it fails, in the gate\'s order', () => {
  assert.equal(heldReason({ ...heldRow, historical: true }, cutoverAt, now), 'first seen over 48h after posting');
  assert.equal(heldReason({ ...heldRow, recordHash: 'old' }, cutoverAt, now), 'content changed since it was judged');
  assert.equal(heldReason({ ...heldRow, recordHash: null }, cutoverAt, now), 'content changed since it was judged');
  assert.equal(heldReason({ ...heldRow, closed: true, historical: true }, cutoverAt, now), 'thread closed');
  assert.equal(heldReason({ ...heldRow, reviewState: 'withdrawn' }, cutoverAt, now), 'withdrawn');
  assert.equal(heldReason({ ...heldRow, classifierVersion: 'independent-lanes-v1:corpus-lanes-v2' }, cutoverAt, now), 'judged by an older classifier');
  assert.equal(heldReason({ ...heldRow, hasEvidence: false }, cutoverAt, now), 'no quoted evidence');
  // Passes every rule the footer can see: the gate's re-validation under current guards held it.
  assert.equal(heldReason(heldRow, cutoverAt, now), 'failed re-validation at publish');
});

test('the footer names what was held and why, capped at five lines', () => {
  const held = Array.from({ length: 7 }, (_, i) => ({ title: `Call ${i}\nnext`, lane: 'funding' as const, reason: 'over 30 days old' }));
  const lines = pipelineLines({ stats: { ...stats, held }, health: { level: 'ok', reasons: [] } }, now);
  assert.equal(lines.held[0], 'Held: Call 0 next (funding: over 30 days old)');
  assert.equal(lines.held.length, 6);
  assert.equal(lines.held[5], '+2 more held');
  const brief = { date: new Date(now), roles: [], grants: [], summary: null, pipeline: { stats: { ...stats, held: [{ title: '<i>x</i>', lane: 'opportunities' as const, reason: 'thread closed' }] }, health: { level: 'ok' as const, reasons: [] } } };
  assert.match(formatDailyBriefText(brief), /3 actionable → 1 published\nHeld: <i>x<\/i> \(opportunities: thread closed\)\n/);
  assert.ok(!formatDailyBriefHtml(brief).includes('<i>x</i>'));
  assert.deepEqual(pipelineLines({ stats, health: { level: 'ok', reasons: [] } }, now).held, []);
});
