import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCorpusExtraction, type CorpusClassificationInput } from '@/lib/corpusClassifier';
import { correctGrantKind } from '@/lib/grantsClassifier';
import { titleGuardKind, EVIDENCE_ASK_RE, PERSONAL_REIMBURSEMENT_RE, fundingKindFromTitle } from '@/lib/titleGuards';

const now = Date.parse('2026-10-06T00:00:00Z');
const evidence = 'Applications are open until the end of the month for community projects.';
const openCall = {
  relevant: true, kind: 'open_call', availability: 'open', engagement: null, paidEvidence: false,
  confidence: 100, evidence, deadline: null, applicationUrl: null,
};
const funding = (title: string): CorpusClassificationInput => ({
  title, body: evidence, tags: [], createdAt: '2026-10-05T00:00:00Z', closed: false, lane: 'funding',
});

test('an applicant submission never publishes as an open call (Oct 5 brief, Zcash)', () => {
  const out = validateCorpusExtraction(openCall, funding('Grant Application - Zcash Shielded Payments: An English/Korean Research Report'), now);
  assert.equal(out.kind, 'application');
  assert.equal(out.actionable, false);
});

test('a genuine open call is untouched by the guards', () => {
  const out = validateCorpusExtraction(openCall, funding('2026 Community Microgrants call for applications'), now);
  assert.equal(out.kind, 'open_call');
  assert.equal(out.actionable, true);
});

test('records and fundraises are reports in both lanes', () => {
  assert.equal(titleGuardKind('Zcash Community Grants Meeting Minutes 8/31/2026', 'funding'), 'report');
  assert.equal(titleGuardKind('Kairos has raised $50M to build agent infra', 'funding'), 'report');
  assert.equal(titleGuardKind('ZecLedger grant update #3', 'funding'), 'report');
  assert.equal(titleGuardKind('Alice Delegate Thread', 'opportunities'), 'report');
  const out = validateCorpusExtraction({ ...openCall, kind: 'paid_work', paidEvidence: true, evidence: 'We are hiring a paid contract engineer.' },
    { ...funding('[Final Report] T3tris.finance'), body: 'We are hiring a paid contract engineer.', lane: 'opportunities' }, now);
  assert.equal(out.actionable, false);
});

test('applicant markers seen in the corpus', () => {
  for (const title of [
    '[Application] Radicle vs. Web3 Tales Conference',
    '[DIS] Vellum: Reputation Extension on did:ckb',
    '[Request-for-grant] Build eth.link to near.link',
    'Retroactive Grant Application - Vizor Wallet',
    'GRANT PROPOSAL: MenoDAO - Bringing Dental Healthcare On-Chain',
    'Grant Application: CoW Playground Offline Development Mode',
  ]) assert.equal(titleGuardKind(title, 'funding'), 'application', title);
});

test('open calls and retro funding rounds are not applicant titles', () => {
  for (const title of [
    'Round 41 - GMC Call for Retrospective Applications - Deadline is October 7',
    'Hop Grants Program Renewal and Redesign',
    'Applications open: Retroactive Funding Round 3',
    '[PROPOSAL] Gitcoin d/acc 2026 Funding Initiative: Restructuring the Grants Program',
  ]) assert.equal(titleGuardKind(title, 'funding'), null, title);
});

test('the legacy path labels applicant titles the same way', () => {
  assert.equal(correctGrantKind('Grant Application: CoW Execution Evidence Lab', 'rfp'), 'application');
});

test('the model quoting an ask demotes an open call in the funding lane (Oct 7 queue, Polkadot)', () => {
  const ask = 'Requested: 14,000 USD';
  const out = validateCorpusExtraction({ ...openCall, evidence: ask },
    { ...funding('[Discussion] PSEUDONYM: generative portraits of Kusama and Polkadot'), body: `Proposal. ${ask}. Timeline.` }, now);
  assert.equal(out.kind, 'application');
  assert.equal(out.actionable, false);
  const call = 'The requested amount must not exceed $50k per team.';
  assert.equal(validateCorpusExtraction({ ...openCall, evidence: call }, { ...funding('Builder grants round 3'), body: call }, now).actionable, true);
});

test('an employer "seeking" a hire stays a paid opening', () => {
  const post = 'We are seeking a paid contract engineer to join the team.';
  const out = validateCorpusExtraction({ ...openCall, kind: 'paid_work', paidEvidence: true, evidence: post },
    { ...funding('[HIRING] Frontend Developer'), body: post, lane: 'opportunities' }, now);
  assert.equal(out.actionable, true);
});

// Funder language must never read as an ask (PR #94 review, 2026-10-07).
test('funder titles stay open calls', () => {
  for (const title of [
    'Grant Application Window Now Open for Season 5',
    'Grant Application Form - Builder Round 3',
    'Grant Application Deadline Extended',
    'Grant Request for Proposals: ZK tooling',
    'Application: Open Call for Infrastructure Grants',
    'Grant Update: Applications for Q4 Round Now Open',
    'Monthly Update: Season 5 grants now open',
    'GG24 raises $1.2M matching pool, applications open',
  ]) assert.equal(titleGuardKind(title, 'funding'), null, title);
});

test('an employer announcing a raise and hiring is still an opening', () => {
  assert.equal(titleGuardKind('Acme raises $20M and is hiring engineers', 'opportunities'), null);
  assert.equal(titleGuardKind('Project Update: Hiring a paid contract dev', 'opportunities'), null);
});

test('guards keep the lanes the legacy path validated them for', () => {
  assert.equal(titleGuardKind('Alice Delegate Thread', 'funding'), null);
  assert.equal(titleGuardKind('ZecLedger grant update #3', 'opportunities'), null);
  assert.equal(titleGuardKind('Grant Application: CoW Playground Offline Development Mode', 'opportunities'), null);
});

test('funder evidence is not an ask; applicant evidence is', () => {
  for (const quote of [
    'We are seeking proposals from teams building',
    'We’re seeking applications for the next cohort',
    'We are requesting proposals for the following RFPs',
    'Requested amount: up to $25,000 per project',
    'Total funding requested must not exceed $50k',
    'Applicants must include a budget breakdown',
    'We are seeking proposals for funding research on AI policy',
    'We are seeking teams that need a grant to build tooling',
    'We are requesting applications for $50k grants',
  ]) assert.equal(EVIDENCE_ASK_RE.test(quote), false, quote);
  for (const quote of [
    'Requested: 14,000 USD',
    'Requested funding: USD 20,000',
    'Total Funding Requested: $15,000 USD (or equivalent in xDAI / USDC)',
    'Total Budget Requested 6300 $',
    'We are seeking funding from the UMA DAO to continue our work',
    'Proposal for Optimism We are seeking a Builder Grant to fund the integration',
    'We’re seeking funding to the tune of $600K.',
    'We are applying for this grant to fund the next phase',
    'Summary This proposal requests a grant of $15,000 USD',
    'Budget breakdown Total: $15,000 USD, payable in CKB, over five months.',
    'Incentive Support (Grant): We are requesting a $120,000 grant for the audit',
    'Budget We are requesting: USD 27,700, paid in CKB equivalent at disbursement',
    'We are requesting a total of 20,000 GTC',
    'We are requesting a budget of 200,000 UMA tokens',
    'Funding Request The total funding requested for this project is 16,800 xDAI',
  ]) assert.equal(EVIDENCE_ASK_RE.test(quote), true, quote);
});

test('an "open" that is not an announcement never rescues a record or update (PR #94 re-review)', () => {
  for (const title of [
    'ZecLedger grant update #3 — open-source release',
    'Grant update: open source wallet milestone 2',
    'Grants Committee Meeting Minutes: open questions',
    'Post-mortem: grants round, why proposals stayed open',
    'Grants Committee Meeting Minutes: applications now open for round 9',
  ]) assert.equal(titleGuardKind(title, 'funding'), 'report', title);
  assert.equal(titleGuardKind('Post-mortem on our hiring process', 'opportunities'), 'report');
});

test('a fundraise that mentions hiring is still not funding (2026-09-02 Kairos)', () => {
  const title = "Kairos has raised $50M to build talent infrastructure for AI safety (and we're hiring!)";
  assert.equal(titleGuardKind(title, 'funding'), 'report');
  assert.equal(titleGuardKind(title, 'opportunities'), null);
});

test('"open for comment" is not an announcement (PR #94 re-review, optional)', () => {
  assert.equal(titleGuardKind('Grant update: open for comment', 'funding'), 'report');
  assert.equal(titleGuardKind('Grant Update: open for applications until Nov 3', 'funding'), null);
});

test('asks phrased as "requests funding" or "Required Funding Total" (Oct 8 brief)', () => {
  for (const quote of [
    'Phase 1 requests funding only for the reasonable costs of incorporation, legal work',
    'Required Funding Total: $600 (equivalent in CKB)',
    'The LiveInfra SPE requests funding for Q2 2026 to sustain the Community Node service',
  ]) assert.equal(EVIDENCE_ASK_RE.test(quote), true, quote);
  const corven = 'Required Funding Total: $600 (equivalent in CKB)';
  const out = validateCorpusExtraction({ ...openCall, evidence: corven },
    { ...funding('Spark Program Proposal: Corven cloud-native IDE'), body: `Proposal. ${corven}. Milestones.` }, now);
  assert.equal(out.actionable, false);
  for (const quote of ['Required funding is disbursed per milestone.', 'Teams that need funding can apply below.'])
    assert.equal(EVIDENCE_ASK_RE.test(quote), false, quote);
});

test('personal expense reimbursement is not project funding (Oct 6, kidney post)', () => {
  const kidney = 'There is funding available that will reimburse up to $6000 of travel/food/lost wage expenses.';
  const out = validateCorpusExtraction({ ...openCall, evidence: kidney }, { ...funding('On donating a kidney'), body: `Essay. ${kidney} More essay.` }, now);
  assert.equal(out.actionable, false);
  assert.equal(PERSONAL_REIMBURSEMENT_RE.test('Funding will reimburse up to $6,000.00 of travel and lost wages.'), true);
  for (const quote of [
    'RFP-47: Creating an Isolated Fractional Reserve Market to Reimburse Radiant Depositors on BSC',
    'Grants reimburse audit costs for projects building on the network.',
    'Devcon travel grants reimburse travel and lodging for selected attendees.',
  ]) assert.equal(PERSONAL_REIMBURSEMENT_RE.test(quote), false, quote);
});

test('published funding gets a kind from its title, not a blanket "Program launch"', () => {
  assert.equal(fundingKindFromTitle('Targeted RFP: Cosmos Hub Sponsored Endpoint Provider'), 'rfp');
  assert.equal(fundingKindFromTitle('Request for Proposals: AI policy in middle powers'), 'rfp');
  assert.equal(fundingKindFromTitle('Round 41 - GMC Call for Retrospective Applications - Deadline is October 7'), 'retro_round');
  assert.equal(fundingKindFromTitle('Retro Funding 7: applications open'), 'retro_round');
  assert.equal(fundingKindFromTitle('Brains Fellowship Applications Open!'), 'fellowship');
  assert.equal(fundingKindFromTitle('DRIP Season 2 Is Live'), 'program_launch');
  assert.equal(fundingKindFromTitle('Strategic Animal Funding Circle: Applications open for autumn'), 'program_launch');
});

test('a thread for discussing submitted applications is a record (Rocket Pool, rounds 37-42)', () => {
  for (const n of [37, 40, 42]) assert.equal(titleGuardKind(`Round ${n} - GMC Community Discussion of Submitted Applications`, 'funding'), 'report');
  assert.equal(titleGuardKind('Round 42 - GMC Call for Grant Applications - Deadline is November 7', 'funding'), null);
});

test('a Snapshot proposal is a vote, never an open call (Oct 10 queue, BIP-933)', () => {
  const fee = '**10,286.807445 USDC** in unclaimed FeeDistributor rewards';
  const vote = validateCorpusExtraction({ ...openCall, evidence: fee }, { ...funding('[BIP-933] Claim Timeless VeBalGrant USDC fees'), body: `Proposal. ${fee}.`,
    url: 'https://snapshot.org/#/balancer.eth/proposal/0x5a66f49d3aa02d9474e13acd1e6ac81d4a93398a8df0ec6b3adbe5170a74d3d8' }, now);
  assert.equal(vote.actionable, false);
  // The same call on a forum stays an open call; a missing URL changes nothing.
  assert.equal(validateCorpusExtraction(openCall, { ...funding('Builder grants round 3'), url: 'https://dao.rocketpool.net/t/round-42/4070' }, now).actionable, true);
  assert.equal(validateCorpusExtraction(openCall, funding('Builder grants round 3'), now).actionable, true);
});
