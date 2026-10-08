import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, initializeSchema } from '../src/lib/db';
import { ensureIntelligence, reviewIntelligence } from '../src/lib/intelligenceStore';
import { validateCorpusExtraction, type CorpusClassify } from '../src/lib/corpusClassifier';
import { runNativeCandidateScan } from '../src/lib/nativeLaneScan';
import { revalidatePublished, withdrawIfStillFailing, REVALIDATION_ACTOR } from '../src/lib/publishRevalidation';

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
  assert.equal(audit.length, 1); assert.equal(audit[0].actor, REVALIDATION_ACTOR); assert.match(audit[0].reason, /^guard: .*kind application/);
  const brief = await db`SELECT g.status FROM grants_items g JOIN funding_records r ON r.compatibility_ref=g.topic_ref_id WHERE r.document_id=${auto}`;
  assert.equal(brief[0].status, 'closed');

  // Idempotent: a withdrawn record is not re-checked or re-withdrawn.
  assert.equal((await revalidatePublished()).withdrawn, 0);

  // Withdrawn content stays withdrawn: re-observing the same post changes nothing.
  await runNativeCandidateScan([candidate(1)], 10, classifier);
  assert.equal((await state(auto)).review_state, 'withdrawn');
  // The author edits it into a real call (new content hash): re-classified, re-approved, mailable again.
  await runNativeCandidateScan([{ ...candidate(1), title: 'Builder grants round 1: applications open' }], 10, classifier);
  assert.equal((await state(auto)).review_state, 'approved');
  const reopened = await db`SELECT g.status, g.notified_at FROM grants_items g JOIN funding_records r ON r.compatibility_ref=g.topic_ref_id WHERE r.document_id=${auto}`;
  assert.equal(reopened[0].status, 'open'); assert.equal(reopened[0].notified_at, null);
});

test('the withdraw re-checks under the row lock (PR #97 review race)', { skip: !testUrl }, async () => {
  const db = getDb();
  const created = new Date(Date.now() - 60_000).toISOString();
  await runNativeCandidateScan([{ refId: 'revalidation-race', forumUrl: source, protocol: 'Revalidation fixture', title: 'Builder grants round 9',
    url: `${source}/t/round/9`, tags: [], body: quote, createdAt: created, bumpedAt: created, signal: 'keywords: grants' }], 10, classifier);
  const id = Number((await db`SELECT id FROM intelligence_documents WHERE ref_id='revalidation-race'`)[0].id);
  const hash = String((await db`SELECT content_hash FROM funding_records WHERE document_id=${id}`)[0].content_hash);
  await db`UPDATE intelligence_documents SET title='Grant Application - ' || title WHERE id=${id}`;

  // A verdict computed on content that has since changed is not acted on.
  assert.equal(await withdrawIfStillFailing(id, 'funding', 'stale-hash'), null);
  assert.equal((await db`SELECT review_state FROM funding_records WHERE document_id=${id}`)[0].review_state, 'approved');
  // The owner's hand approval lands between the sweep's read and its write. (An operator can only
  // approve passing content, so model it as the approval switching to the owner on the same row.)
  await db`UPDATE funding_records SET reviewed_by='admin' WHERE document_id=${id}`;
  assert.equal(await withdrawIfStillFailing(id, 'funding', hash), null);
  assert.equal((await db`SELECT review_state FROM funding_records WHERE document_id=${id}`)[0].review_state, 'approved');
  // Restored to the auto-approver, the same call now withdraws, with the locked verdict as its reason.
  await db`UPDATE funding_records SET reviewed_by='fresh-evidence-policy-v1' WHERE document_id=${id}`;
  assert.match((await withdrawIfStillFailing(id, 'funding', hash))!, /^guard: /);
});

test('the opportunities lane is swept too', { skip: !testUrl }, async () => {
  const db = getDb();
  const created = new Date(Date.now() - 60_000).toISOString();
  const job = 'We are hiring an operations lead for a paid six-month contract.';
  const jobs: CorpusClassify = async input => ({ model: 'fixture-revalidation', extraction: validateCorpusExtraction({
    relevant: input.lane === 'opportunities', kind: input.lane === 'opportunities' ? 'paid_work' : 'other', availability: 'open',
    engagement: 'contract', paidEvidence: true, confidence: 95, evidence: job, deadline: null, applicationUrl: null }, input) });
  await runNativeCandidateScan([{ refId: 'revalidation-job', forumUrl: source, protocol: 'Revalidation fixture', title: 'Operations lead',
    url: `${source}/t/job/1`, tags: [], body: job, createdAt: created, bumpedAt: created, signal: 'roles: hiring' }], 10, jobs);
  const id = Number((await db`SELECT id FROM intelligence_documents WHERE ref_id='revalidation-job'`)[0].id);
  assert.equal((await db`SELECT review_state FROM opportunity_records WHERE document_id=${id}`)[0].review_state, 'approved');
  await db`UPDATE intelligence_documents SET title='Hiring post-mortem: operations lead' WHERE id=${id}`;
  await revalidatePublished();
  assert.equal((await db`SELECT review_state FROM opportunity_records WHERE document_id=${id}`)[0].review_state, 'withdrawn');
});

test('an item the legacy pipeline already mailed is never mailed again after an edit (PR #97 re-review)', { skip: !testUrl }, async () => {
  const db = getDb();
  const created = new Date(Date.now() - 60_000).toISOString();
  const post = { refId: 'revalidation-legacy', forumUrl: source, protocol: 'Revalidation fixture', title: 'Builder grants round 7',
    url: `${source}/t/round/7`, tags: [], body: quote, createdAt: created, bumpedAt: created, signal: 'keywords: grants' };
  // The legacy classifier published and mailed this topic before the native record existed.
  await db`INSERT INTO grants_items(topic_ref_id,protocol,vertical,title,url,classification,confidence,kind,signal,notified_at,topic_created_at)
    VALUES(${post.refId},'Revalidation fixture','crypto',${post.title},${post.url},'GRANT',90,'rfp','keywords: grants',now()-interval '1 hour',${created})`;
  await runNativeCandidateScan([post], 10, classifier);
  const id = Number((await db`SELECT id FROM intelligence_documents WHERE ref_id=${post.refId}`)[0].id);
  const record = (await db`SELECT review_state, notification_state FROM funding_records WHERE document_id=${id}`)[0];
  assert.deepEqual(record, { review_state: 'approved', notification_state: 'sent' });
  // An edit closes the row; the fresh re-approval of the new content must keep the mail stamp.
  await runNativeCandidateScan([{ ...post, title: 'Builder grants round 7: applications open' }], 10, classifier);
  const row = (await db`SELECT status, notified_at FROM grants_items WHERE topic_ref_id=${post.refId}`)[0];
  assert.equal(row.status, 'open');
  assert.notEqual(row.notified_at, null);
});
