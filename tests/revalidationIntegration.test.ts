import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, initializeSchema } from '../src/lib/db';
import { ensureIntelligence, reviewIntelligence } from '../src/lib/intelligenceStore';
import { validateCorpusExtraction, type CorpusClassify } from '../src/lib/corpusClassifier';
import { runNativeCandidateScan } from '../src/lib/nativeLaneScan';
import { revalidatePublished, REVALIDATION_ACTOR } from '../src/lib/publishRevalidation';

const testUrl = process.env.CORPUS_TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
after(async () => { if (testUrl) await getDb().end({ timeout: 5 }); });

const source = 'https://forum.revalidation.example';
const quote = 'Applications are open for project grants of $50,000 this quarter.';
const classifier: CorpusClassify = async input => ({
  model: 'fixture-revalidation',
  extraction: validateCorpusExtraction({
    relevant: input.lane === 'funding', kind: input.lane === 'funding' ? 'open_call' : 'other', availability: 'open',
    engagement: null, paidEvidence: false, confidence: 95, evidence: quote, deadline: null, applicationUrl: null,
  }, input),
});

test('a tightened guard withdraws auto-approved records and leaves operator approvals alone', { skip: !testUrl }, async () => {
  await initializeSchema(); await ensureIntelligence();
  const db = getDb();
  await db`INSERT INTO ingestion_sources(source_key,name,url,adapter,vertical,managed_by) VALUES(${source},'Revalidation fixture',${source},'discourse','crypto','preset') ON CONFLICT DO NOTHING`;
  await db`UPDATE intelligence_settings SET value=jsonb_build_object('at',now()-interval '10 minutes') WHERE name='native-cutover'`;
  const created = new Date(Date.now() - 60_000).toISOString();
  const candidate = (n: number) => ({ refId: `revalidation-${n}`, forumUrl: source, protocol: 'Revalidation fixture', title: `Builder grants round ${n}`,
    url: `${source}/t/round/${n}`, tags: [], body: quote, createdAt: created, bumpedAt: created, signal: 'keywords: grants' });

  await runNativeCandidateScan([candidate(1), candidate(2)], 10, classifier);
  const docs = await db`SELECT id, ref_id FROM intelligence_documents WHERE ref_id IN ('revalidation-1','revalidation-2') ORDER BY ref_id`;
  const [auto, manual] = docs.map(d => Number(d.id));
  const state = async (id: number) => (await db`SELECT review_state, reviewed_by FROM funding_records WHERE document_id=${id}`)[0];
  assert.deepEqual(await state(auto), { review_state: 'approved', reviewed_by: 'fresh-evidence-policy-v1' });

  // The owner re-approves the second record by hand in the operator UI.
  await reviewIntelligence(manual, 'funding', 'withdraw', 'admin', 'fixture: reset before a manual approval');
  await db`UPDATE funding_records SET review_state='pending' WHERE document_id=${manual}`;
  await reviewIntelligence(manual, 'funding', 'approve', 'admin', 'fixture: owner approved by hand');
  assert.equal((await state(manual)).reviewed_by, 'admin');

  // Nothing has changed yet, so the sweep withdraws nothing.
  assert.equal((await revalidatePublished()).withdrawn, 0);

  // Simulate a guard arriving after approval: both titles now read as applicant submissions.
  await db`UPDATE intelligence_documents SET title='Grant Application - ' || title WHERE id IN (${auto}, ${manual})`;
  const result = await revalidatePublished();
  assert.equal(result.withdrawn, 1);
  assert.equal((await state(auto)).review_state, 'withdrawn');
  assert.deepEqual(await state(manual), { review_state: 'approved', reviewed_by: 'admin' });

  const audit = await db`SELECT actor, reason FROM intelligence_reviews WHERE document_id=${auto} AND action='withdraw'`;
  assert.equal(audit.length, 1); assert.equal(audit[0].actor, REVALIDATION_ACTOR); assert.match(audit[0].reason, /kind application/);
  const brief = await db`SELECT g.status FROM grants_items g JOIN funding_records r ON r.compatibility_ref=g.topic_ref_id WHERE r.document_id=${auto}`;
  assert.equal(brief[0].status, 'closed');

  // Idempotent: a withdrawn record is not re-checked or re-withdrawn.
  assert.equal((await revalidatePublished()).withdrawn, 0);
});
