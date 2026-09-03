import test from 'node:test';
import assert from 'node:assert/strict';
import { isHighlightGrant } from '@/lib/dailyBrief';
import type { BriefItemRow } from '@/lib/grantsStore';

function row(over: Partial<BriefItemRow>): BriefItemRow {
  return {
    id: 1, topic_ref_id: 't-1', protocol: 'Test', vertical: 'crypto',
    title: 'x', url: 'https://example.org/t/x/1', kind: null, confidence: 90,
    program: null, amount_min: null, amount_max: null, currency: 'USD',
    deadline: null, topic_created_at: new Date(), first_seen_at: new Date(),
    ...over,
  };
}

test('a budget debate is not a highlight even at a six-figure amount', () => {
  // Real item, 2026-09-03: Compound renewing an existing service provider
  // reached the highlights purely by hitting the 100k threshold.
  assert.equal(isHighlightGrant(row({ kind: 'budget_debate', amount_max: '100000' })), false);
});

test('a milestone report is not a highlight even at a large amount', () => {
  assert.equal(isHighlightGrant(row({ kind: 'milestone_report', amount_max: '1000000' })), false);
});

test('a treasury-scale budget debate is still a highlight', () => {
  // A DAO allocating $199M is the kind of signal the brief should lead with,
  // even though nobody can "apply" to it. Only small renewals drop out.
  assert.equal(isHighlightGrant(row({ kind: 'budget_debate', amount_max: '199000000' })), true);
});

test('a program launch is always a highlight', () => {
  assert.equal(isHighlightGrant(row({ kind: 'program_launch' })), true);
});

test('a large open application is still a highlight', () => {
  assert.equal(isHighlightGrant(row({ kind: 'application', amount_max: '300740' })), true);
});

test('an imminent deadline is still a highlight', () => {
  const d = new Date(Date.now() + 3 * 86_400_000);
  assert.equal(isHighlightGrant(row({ kind: 'application', deadline: d })), true);
});

test('a budget debate with an imminent deadline stays out of the highlights', () => {
  const d = new Date(Date.now() + 3 * 86_400_000);
  assert.equal(isHighlightGrant(row({ kind: 'budget_debate', deadline: d })), false);
});
