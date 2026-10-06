import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDailyBriefHtml, formatDailyBriefText, pipelineLines } from '@/lib/dailyBrief';
import type { PipelineStats } from '@/lib/pipelineHealth';

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
