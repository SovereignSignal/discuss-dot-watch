import test from 'node:test';
import assert from 'node:assert/strict';
import { dateMentioned, amountMentioned, currencyMentioned, programMentioned } from '@/lib/extractionGrounding';
import { validateCorpusExtraction, type CorpusClassificationInput } from '@/lib/corpusClassifier';
import { revalidationVerdict } from '@/lib/publishRevalidation';

test('a deadline written the way forum posts write it is grounded', () => {
  for (const text of [
    'Application deadline: 1 November 2026, 11:59 pm PST.',
    'Apply by November 1st, 2026.',
    'Applications close Nov. 1, 2026',
    'Deadline is 1st of November',
    'We are accepting applications October 4–1 November', // day-first range
    'Submissions due 2026-11-01.',
  ]) assert.equal(dateMentioned('2026-11-01', text, 2026), true, text);
  assert.equal(dateMentioned('2026-08-25', 'We are accepting applications August 4–25 AoE.', 2026), true);
  assert.equal(dateMentioned('2024-09-30', 'This wave will last until end of September 2024.', 2024), true);
  assert.equal(dateMentioned('2027-01-15', 'Deadline: January 15', 2026), true); // December post, next-year deadline
});

test('dates the source never states are rejected', () => {
  assert.equal(dateMentioned('2026-11-01', 'Applications open for three weeks from today.', 2026), false);
  assert.equal(dateMentioned('2026-11-01', 'Deadline: 11 November 2026', 2026), false);
  assert.equal(dateMentioned('2026-11-01', 'Deadline: 1 November 2025', 2026), false);
  assert.equal(dateMentioned('2026-11-01', 'Deadline: 11/01/2026', 2026), false); // ambiguous across locales
  assert.equal(dateMentioned('2026-09-11', 'Digest September 02, 2026: voting September 14–25', 2026), false);
  assert.equal(dateMentioned('2029-11-01', 'Deadline: November 1', 2026), false); // year without support
});

test('amounts must be stated, after k/m scaling, never computed', () => {
  assert.equal(amountMentioned(200000, 'smaller funding requests (under $200k)'), true);
  assert.equal(amountMentioned(10000, 'Requested Funding Amount: $10’000'), true);
  assert.equal(amountMentioned(40904, 'requesting a total of 40904USD (€36000)'), true);
  assert.equal(amountMentioned(113602, 'Balancer OpCo is requesting $113,602for 3 months'), true);
  assert.equal(amountMentioned(1500000, 'a pool of $1.5M for builders'), true);
  // Real misreads the 2026-10-09 smoke test caught in legacy extractions:
  assert.equal(amountMentioned(75, 'Requested Grant Size: [75k ARB]'), false);
  assert.equal(amountMentioned(4400, 'Flights | $3800 USD Airbnb apartment | $600 USD'), false); // a sum
  assert.equal(amountMentioned(200000, 'Budget : $50K per quarter'), false); // a product
});

test('currency must be named or symbolised in the source', () => {
  assert.equal(currencyMentioned('USD', 'under $200k'), 'USD');
  assert.equal(currencyMentioned('$', 'under $200k'), 'USD');
  assert.equal(currencyMentioned('$AURORA', 'an allocation of 5M AURORA'), 'AURORA');
  assert.equal(currencyMentioned('EUR', 'up to $200k'), null);
  assert.equal(currencyMentioned('USDC/OP Equivalent', '10k USDC'), null);
});

test('a program name must appear and add something the title does not', () => {
  assert.equal(programMentioned('Radicle Grants Program', 'Funded through the Radicle Grants Program.', 'Radicle IDE Plugins (VS Code + Jetbrains IDE)'), 'Radicle Grants Program');
  assert.equal(programMentioned('Zcash Community Grants', 'Zcash Community Grants Application VaihtoFX ...', 'Zcash Community Grants Application VaihtoFX: Shielded ZEC On/Off-Ramp via M-Pesa'), null);
  assert.equal(programMentioned('Radicle CI Integrations', 'Radicle CI Integrations body', 'Radicle CI Integrations'), null);
  assert.equal(programMentioned('CoW Protocol Playground Performance Testing Suite RFP', 'RFP: CoW Protocol Playground Performance Testing Suite', 'RFP: CoW Protocol Playground Performance Testing Suite'), null);
});

const SAFC = 'Applications open: Strategic Animal Funding Circle autumn 2026 round The Strategic Animal Funding Circle, now run by Senterra Funders, is accepting applications for its autumn 2026 funding round. Application deadline: 1 November 2026, 11:59 pm PST. Opportunities outside larger grantmakers’ scope, including smaller funding requests (under $200k), and organisations with annual budgets below US$500,000.';
const safc: CorpusClassificationInput = { title: 'Strategic Animal Funding Circle: Applications open for autumn 2026', body: SAFC, tags: [], createdAt: '2026-10-08T00:00:00Z', closed: false, lane: 'funding' };
const base = { relevant: true, kind: 'open_call', availability: 'open', engagement: null, paidEvidence: false, confidence: 95,
  evidence: 'is accepting applications for its autumn 2026 funding round', applicationUrl: null };
const now = Date.parse('2026-10-09T14:00:00Z');

test('the Oct 9 brief item keeps its deadline and amount when the model states them', () => {
  const out = validateCorpusExtraction({ ...base, deadline: '2026-11-01', amountMax: 200000, amountMin: null, currency: 'USD', program: 'Strategic Animal Funding Circle' }, safc, now);
  assert.equal(out.deadline, '2026-11-01');
  assert.equal(out.amountMax, 200000);
  assert.equal(out.currency, 'USD');
  assert.equal(out.program, null); // the title already says it
  assert.equal(out.actionable, true);
});

test('invented fields are dropped, and a mis-read year is not a deadline', () => {
  const out = validateCorpusExtraction({ ...base, deadline: '2026-10-29', amountMax: 250000, currency: 'EUR', program: 'Animal Fund Round' }, safc, now);
  assert.deepEqual([out.deadline, out.amountMax, out.currency, out.program], [null, null, null, null]);
  // A year the text does not state is never accepted.
  assert.equal(validateCorpusExtraction({ ...base, deadline: '2025-11-01' }, safc, now).deadline, null);
  // A stated deadline that already passed is kept, and closes the item.
  const closedOut = validateCorpusExtraction({ ...base, deadline: '2026-10-01' }, { ...safc, body: SAFC + ' The previous round closed on 1 October 2026.' }, now);
  assert.equal(closedOut.deadline, '2026-10-01');
  assert.equal(closedOut.availability, 'closed');
  assert.equal(closedOut.actionable, false);
});

test('records stored before these fields existed still validate and are not withdrawn', () => {
  const stored = { ...base, deadline: null, actionable: true, reviewRequired: true }; // the pre-2026-10-09 shape
  assert.equal(validateCorpusExtraction(stored, safc, now).actionable, true);
  assert.equal(revalidationVerdict({ extraction: stored, title: safc.title, body: safc.body, tags: [], createdAt: safc.createdAt, closed: false, lane: 'funding' }, now), null);
});

// PR #98 review: values that must NOT ground, because a grounded date can close a live call.
test('dates that are not deadlines do not ground', () => {
  const no: Array<[string, string]> = [
    ['2026-05-01', 'Step 1 may require a deadline extension.'],
    ['2026-03-02', 'Phase 2 march toward the deadline.'],
    ['2026-11-01', 'Milestone 1 - November 2026 deliverables.'],
    ['2026-10-01', 'Plan for Q1. Oct deadline review.'],
    ['2026-02-13', 'Release v2.13.2026 ships the deadline fix.'],
    ['2026-11-01', 'The round opens November 1 and closes November 30.'],
    ['2026-11-01', 'Our community call happened on 1 November 2026 with 40 people.'], // no deadline language
  ];
  for (const [iso, text] of no) assert.equal(dateMentioned(iso, text, 2026), false, text);
  assert.equal(dateMentioned('2026-11-30', 'The round opens November 1 and closes November 30.', 2026), true);
  assert.equal(dateMentioned('2026-05-01', 'Applications are due May 1.', 2026), true);
  assert.equal(dateMentioned('2026-10-31', 'Submit by 31/10/2026.', 2026), true);
});

test('amounts that are not money do not ground', () => {
  assert.equal(amountMentioned(3, 'We build web3 tooling and need funding.'), false);
  assert.equal(amountMentioned(2026, 'The 2026 round funds tooling.'), false);
  assert.equal(amountMentioned(10, 'We will fund up to 10 projects.'), false);
  assert.equal(amountMentioned(1202, 'Planned for Q1 2026.'), false);
  assert.equal(amountMentioned(3200000, 'We are awarding 3 200k grants.'), true); // ambiguous: both readings stated
  assert.equal(amountMentioned(200000, 'We are awarding 3 200k grants.'), true);
  assert.equal(amountMentioned(50, 'Small grants of $50 each.'), true);
  assert.equal(amountMentioned(2000, 'A stipend of 2,000 USDC.'), true);
});

test('European and spaced thousands ground', () => {
  assert.equal(amountMentioned(50000, 'Budget: €50.000 for the pilot.'), true);
  assert.equal(amountMentioned(1000000, 'A fund of €1.000.000.'), true);
  assert.equal(amountMentioned(50000, 'Total: 50.000,00 €'), true);
  assert.equal(amountMentioned(20000, 'Requested: USD 20,000'), true);
  assert.equal(amountMentioned(5000, 'Grant of 5 000 USD'), true);
});

test('currency needs the symbol on a number, or the code in capitals', () => {
  assert.equal(currencyMentioned('USD', 'Grants paid in $OP tokens, 50k OP total.'), null);
  assert.equal(currencyMentioned('OP', 'Grants paid in $OP tokens, 50k OP total.'), 'OP');
  assert.equal(currencyMentioned('NEAR', 'Projects near completion get 5k.'), null);
  assert.equal(currencyMentioned('NEAR', 'Grants of 5,000 NEAR.'), 'NEAR');
  assert.equal(currencyMentioned('EUR', 'Budget: €50.000 for the pilot.'), 'EUR');
  assert.equal(currencyMentioned('USD', 'stipend of 40 usd per day'), 'USD');
});

test('lower-case-led tickers and Swiss amounts ground (sweep iteration 4)', () => {
  assert.equal(amountMentioned(2000, 'Funding request: 2,000 xDAI'), true);
  assert.equal(amountMentioned(25, 'Offering 25.- € to KDE'), true);
  assert.equal(currencyMentioned('xDAI', 'Funding request: 2,000 xDAI'), 'xDAI');
  assert.equal(currencyMentioned('cUSD', 'every cUSD and CELO in and out'), 'cUSD');
  assert.equal(currencyMentioned('EUR', 'Offering 25.- € to KDE'), 'EUR');
  assert.equal(currencyMentioned('NEAR', 'Projects Near completion get 5k.'), null);
});

test('a legacy takeover keeps only legacy values that ground now (PR #98 review)', async () => {
  const { briefFields } = await import('@/lib/extractionGrounding');
  const none = { deadline: null, program: null, amountMin: null, amountMax: null, currency: null, applyUrl: null };
  const text = 'Builder grants round 8. Funded through the Builder Program. Grants of 25,000 USDC. Applications close 30 November 2026. Apply at https://example.org/apply';
  const legacy = { deadline: new Date('2026-11-30T00:00:00Z'), program: 'Builder Program', amount_min: null, amount_max: '25000', currency: 'USDC', apply_url: 'https://example.org/apply' };
  const now = Date.parse('2026-10-09T00:00:00Z');
  assert.deepEqual(briefFields(none, legacy, text, 'Builder grants round 8', 2026, now),
    { deadline: '2026-11-30', program: 'Builder Program', amountMin: null, amountMax: 25000, currency: 'USDC', applyUrl: 'https://example.org/apply' });
  // A hallucinated or stale legacy deadline, an amount the text no longer states, a vanished URL: all dropped.
  const stale = { ...legacy, deadline: new Date('2026-09-30T00:00:00Z'), amount_max: '90000', apply_url: 'https://old.example.org' };
  assert.deepEqual(briefFields(none, stale, text, 'Builder grants round 8', 2026, now),
    { deadline: null, program: 'Builder Program', amountMin: null, amountMax: null, currency: null, applyUrl: null });
  // Native values always win, and amount/currency never mix sources.
  const native = { ...none, amountMax: 25000, currency: 'USDC' };
  assert.equal(briefFields(native, { ...legacy, currency: 'USD' }, text, 'Builder grants round 8', 2026, now).currency, 'USDC');
  // No legacy row: native values pass through untouched.
  assert.deepEqual(briefFields(native, null, text, 'x', 2026, now), native);
});

test('PR #98 re-review: last edge cases', () => {
  assert.equal(dateMentioned('2026-11-01', 'Applications due 2026-11-01T23:59:00Z.', 2026), true);
  assert.equal(dateMentioned('2026-11-01', 'Launch: November 1 (applications open), closing later.', 2026), false);
  assert.equal(amountMentioned(10, 'We will fund up to 10 AI projects.'), false);
  assert.equal(amountMentioned(10, 'Grants of 10 ETH each.'), true);
  assert.equal(currencyMentioned('ETH', 'Grants of 2 eth each.'), 'ETH');
  assert.equal(currencyMentioned('USD', 'a budget of 50k US$'), 'USD');
  assert.equal(currencyMentioned('USD', 'about 60 dollars per hour'), 'USD');
  assert.equal(amountMentioned(60, 'about 60 dollars per hour'), true);
});
