import test from 'node:test';
import assert from 'node:assert/strict';
import { planBrief, displayProtocol, formatDailyBriefText, summaryLines, shouldSummarize } from '@/lib/dailyBrief';
import { correctGrantKind } from '@/lib/grantsClassifier';
import type { BriefItemRow } from '@/lib/grantsStore';

let nextId = 1;
function row(over: Partial<BriefItemRow>): BriefItemRow {
  const id = nextId++;
  return {
    id, topic_ref_id: `t-${id}`, protocol: 'Test', vertical: 'crypto',
    title: `item ${id}`, url: `https://example.org/t/x/${id}`, kind: 'application', confidence: 90,
    program: null, amount_min: null, amount_max: null, currency: 'USD',
    deadline: null, topic_created_at: new Date(), first_seen_at: new Date(),
    ...over,
  };
}

test('several applications from one community collapse into one entry', () => {
  // Sep 30 brief: two Zcash applications plus one CoW application.
  const plan = planBrief([], [
    row({ protocol: 'Zcash', amount_max: '45000' }),
    row({ protocol: 'CoW Protocol' }),
    row({ protocol: 'Zcash', amount_max: '45000' }),
  ]);
  assert.equal(plan.rest.length, 2);
  assert.equal(plan.rest[0].protocol, 'Zcash');
  assert.equal(plan.rest[0].items.length, 2);
});

test('highlights never collapse, even from the same community', () => {
  const plan = planBrief([], [
    row({ protocol: 'Zcash', kind: 'program_launch' }),
    row({ protocol: 'Zcash', kind: 'program_launch' }),
  ]);
  assert.equal(plan.highlights.length, 2);
});

test('election threads from one community merge; other roles stay separate', () => {
  // Ubuntu Community Council 2026: four nomination threads for one election.
  const plan = planBrief([
    row({ protocol: 'Ubuntu Discourse', kind: 'council_seat' }),
    row({ protocol: 'Ubuntu Discourse', kind: 'election' }),
    row({ protocol: 'ea-forum', kind: 'service_provider' }),
    row({ protocol: 'ea-forum', kind: 'service_provider' }),
  ], []);
  assert.equal(plan.roles.length, 3);
  assert.equal(plan.roles[0].items.length, 2);
});

test('the same title twice in one batch is mailed once', () => {
  // Balancer BIP-929 arrived as two Snapshot proposals with one title.
  const plan = planBrief([], [
    row({ title: '[BIP-929] Fork and Reincarnate', kind: 'program_launch' }),
    row({ title: '[bip-929] fork and reincarnate ', kind: 'application', amount_max: '6000000' }),
  ]);
  assert.equal(plan.highlights.length + plan.rest.length, 1);
});

test('source ids read as names', () => {
  assert.equal(displayProtocol('ea-forum'), 'EA Forum');
  assert.equal(displayProtocol('Zcash'), 'Zcash');
  assert.equal(displayProtocol(null), 'Unknown');
});

test('a grouped entry lists every title and the total ask in the text part', () => {
  const text = formatDailyBriefText({
    date: new Date('2026-09-30T14:00:00Z'),
    roles: [],
    grants: [
      row({ protocol: 'Zcash', title: 'Nozy Sync Engine', amount_max: '45000' }),
      row({ protocol: 'Zcash', title: '0xramp', amount_max: '45000' }),
    ],
    summary: null,
  });
  assert.match(text, /\[Zcash\] 2 new grant applications/);
  assert.match(text, /- Nozy Sync Engine/);
  assert.match(text, /90,000 USD requested/);
  assert.doesNotMatch(text, /\n {3,}\n/);
});

test('grant updates are progress reports', () => {
  assert.equal(correctGrantKind('ZecLedger grant update', 'application'), 'milestone_report');
  assert.equal(correctGrantKind('[Grant Update] Tally UX for Compound-Specific Proposals', 'application'), 'milestone_report');
});

test('workstream renewals are budget debates, program renewals are not', () => {
  assert.equal(correctGrantKind('SCP-224: Engineering Workstream Renewal: October 1, 2026 – June 30, 2027', 'application'), 'budget_debate');
  assert.equal(correctGrantKind('Hop Grants Program Renewal and Redesign', 'program_launch'), 'program_launch');
});

test('ordinary titles keep the model kind', () => {
  assert.equal(correctGrantKind('Fast grants for AI x animals', 'program_launch'), 'program_launch');
  assert.equal(correctGrantKind('Grant Application - 0xramp', null), null);
});

test('a token-denominated amount does not make a highlight; a dollar one does', () => {
  // 2026-10-01: 8,263,000 CKB (worth a few tens of thousands) led the highlights.
  const plan = planBrief([], [
    row({ protocol: 'Nervos Talk', amount_max: '8263000', currency: 'CKB' }),
    row({ protocol: 'Aave DAO', amount_max: '25000000', currency: 'GHO' }),
  ]);
  assert.deepEqual(plan.highlights.map(e => e.protocol), ['Aave DAO']);
});

test('a Nervos [DIS] proposal is an application, not an RFP', () => {
  assert.equal(correctGrantKind('[DIS] Bitcoin Renegade Meet Up and Media Campaign', 'rfp'), 'application');
});

test('the brief link has no doubled slash when the app URL ends in one', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.discuss.watch/';
  try {
    const text = formatDailyBriefText({ date: new Date(), roles: [], grants: [row({})], summary: null });
    assert.match(text, /Open: https:\/\/www\.discuss\.watch\/app\n/);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = prev;
  }
});

test('summary lines tag each item with its kind so a report never reads as an opportunity', () => {
  // The 2026-10-02 items behind a summary that led with a results post.
  const lines = summaryLines(planBrief(
    [row({ protocol: 'ea-forum', title: 'Geefrevolutie is hiring!', kind: 'working_group' })],
    [
      row({ protocol: 'lesswrong', title: '2026 SFF grants', kind: 'program_launch', amount_max: '65000000' }),
      row({ protocol: 'Arbitrum', title: '[Final Report] T3tris.finance', kind: 'milestone_report', amount_max: '25000' }),
      row({ protocol: 'Zcash', title: 'Docs', kind: 'application', amount_max: '40904' }),
      row({ protocol: 'Zcash', title: 'Wallet', kind: 'application', amount_max: '20000' }),
    ],
  ));
  assert.deepEqual(lines, [
    '[EA Forum] Geefrevolutie is hiring! (Role: Working group)',
    '[LessWrong] 2026 SFF grants (Program launch; 65,000,000 USD)',
    '[Arbitrum] [Final Report] T3tris.finance (Milestone report; 25,000 USD)',
    '[Zcash] 2 new grant applications (Application)',
  ]);
});

test('the summary threshold counts items, not folded lines', () => {
  // 2026-10-03: one RFP + two Zcash applications folded to 2 lines, and the
  // brief went out with no summary at all.
  const plan = planBrief([], [
    row({ protocol: 'EA Forum', kind: 'rfp' }),
    row({ protocol: 'Zcash', kind: 'application', amount_max: '10000' }),
    row({ protocol: 'Zcash', kind: 'application', amount_max: '24000' }),
  ]);
  assert.equal(summaryLines(plan).length, 2);
  assert.equal(shouldSummarize(plan), true);
  assert.equal(shouldSummarize(planBrief([], [row({ kind: 'rfp' }), row({ kind: 'rfp' })])), false);
});
