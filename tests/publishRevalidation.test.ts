import test from 'node:test';
import assert from 'node:assert/strict';
import { revalidationVerdict, type RevalidationInput } from '@/lib/publishRevalidation';

const now = Date.parse('2026-10-08T20:00:00Z');
const quote = 'Applications are open until the end of the month for community projects.';
const approved = { relevant: true, kind: 'open_call', availability: 'open', engagement: null, paidEvidence: false, confidence: 95, evidence: quote, deadline: null, applicationUrl: null, actionable: true, reviewRequired: true };
const base: RevalidationInput = { extraction: approved, title: 'Builder grants round 3', body: quote, tags: [], createdAt: '2026-10-06T00:00:00Z', closed: false, lane: 'funding' };

test('a record that still passes is kept', () => {
  assert.equal(revalidationVerdict(base, now), null);
});

test('records approved before a guard existed are withdrawn (Oct 5-8 leaks)', () => {
  assert.match(revalidationVerdict({ ...base, title: 'Grant Application - Zcash Shielded Payments: An English/Korean Research Report' }, now)!, /kind application/);
  const corven = 'Required Funding Total: $600 (equivalent in CKB)';
  assert.match(revalidationVerdict({ ...base, title: 'Spark Program Proposal: Corven cloud-native IDE', body: `Proposal. ${corven}.`, extraction: { ...approved, evidence: corven } }, now)!, /kind application/);
});

test('a closed source or a passed deadline withdraws; an unreadable extraction is reported', () => {
  assert.match(revalidationVerdict({ ...base, closed: true }, now)!, /availability closed/);
  const due = 'Applications close 2026-10-01 for community projects.';
  assert.match(revalidationVerdict({ ...base, body: due, extraction: { ...approved, evidence: due, deadline: '2026-10-01' } }, now)!, /availability closed/);
  assert.equal(revalidationVerdict({ ...base, extraction: { kind: 'nonsense' } }, now), 'stored extraction no longer validates');
});
