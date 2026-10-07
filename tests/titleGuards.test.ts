import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCorpusExtraction, type CorpusClassificationInput } from '@/lib/corpusClassifier';
import { correctGrantKind } from '@/lib/grantsClassifier';
import { titleGuardKind } from '@/lib/titleGuards';

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
  assert.equal(titleGuardKind('Zcash Community Grants Meeting Minutes 8/31/2026'), 'report');
  assert.equal(titleGuardKind('Kairos has raised $50M to build agent infra'), 'report');
  assert.equal(titleGuardKind('ZecLedger grant update #3'), 'report');
  assert.equal(titleGuardKind('Alice Delegate Thread'), 'report');
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
  ]) assert.equal(titleGuardKind(title), 'application', title);
});

test('open calls and retro funding rounds are not applicant titles', () => {
  for (const title of [
    'Round 41 - GMC Call for Retrospective Applications - Deadline is October 7',
    'Hop Grants Program Renewal and Redesign',
    'Applications open: Retroactive Funding Round 3',
    '[PROPOSAL] Gitcoin d/acc 2026 Funding Initiative: Restructuring the Grants Program',
  ]) assert.equal(titleGuardKind(title), null, title);
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
