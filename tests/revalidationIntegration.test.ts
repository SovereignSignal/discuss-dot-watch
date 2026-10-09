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

test('grounded deadline, amount and program travel from classification to the rendered brief', { skip: !testUrl }, async () => {
  const db = getDb();
  const { getUnnotifiedItems } = await import('../src/lib/grantsStore');
  const { formatDailyBriefText } = await import('../src/lib/dailyBrief');
  const created = new Date(Date.now() - 60_000);
  const deadline = new Date(created.getTime() + 20 * 86400000);
  const human = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); // "29 October 2026"
  const iso = deadline.toISOString().slice(0, 10);
  const body = `${quote} Funded through the Falcon Fund. Requests up to $50k. Application deadline: ${human}.`;
  const fields: CorpusClassify = async input => ({ model: 'fixture-fields', extraction: validateCorpusExtraction({
    relevant: input.lane === 'funding', kind: input.lane === 'funding' ? 'open_call' : 'other', availability: 'open', engagement: null,
    paidEvidence: false, confidence: 95, evidence: quote, applicationUrl: null,
    deadline: iso, amountMin: null, amountMax: 50000, currency: 'USD', program: 'Falcon Fund' }, input) });
  await runNativeCandidateScan([{ refId: 'fields-1', forumUrl: source, protocol: 'Revalidation fixture', title: 'Fast grants for AI x animals',
    url: `${source}/t/fields/1`, tags: [], body, createdAt: created.toISOString(), bumpedAt: created.toISOString(), signal: 'keywords: grants' }], 10, fields);
  const row = (await db`SELECT program, amount_min, amount_max, currency, deadline FROM grants_items WHERE title='Fast grants for AI x animals'`)[0];
  assert.deepEqual([row.program, row.amount_min, Number(row.amount_max), row.currency, row.deadline.toISOString().slice(0, 10)], ['Falcon Fund', null, 50000, 'USD', iso]);
  const queued = (await getUnnotifiedItems('GRANT')).filter(i => i.title === 'Fast grants for AI x animals');
  assert.equal(queued.length, 1);
  const text = formatDailyBriefText({ date: new Date(), roles: [], grants: queued, summary: null });
  assert.match(text, new RegExp(`Falcon Fund · Amount: up to 50,000 USD · Deadline: ${iso}`));
});

test('a legacy takeover keeps legacy fields only where they ground in the current text (PR #98 review)', { skip: !testUrl }, async () => {
  const db = getDb();
  const created = new Date(Date.now() - 60_000).toISOString();
  const deadline = new Date(Date.now() + 30 * 86400000);
  const human = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const body = `${quote} Funded through the Builder Program. Grants of 25,000 USDC. Applications close ${human}.`;
  const insertLegacy = (ref: string, n: number, extra: { deadline: string; amount: number }) => db`INSERT INTO grants_items(topic_ref_id,protocol,vertical,title,url,classification,confidence,kind,signal,program,amount_max,currency,deadline,topic_created_at)
    VALUES(${ref},'Revalidation fixture','crypto',${`Builder grants round ${n}`},${`${source}/t/round/${n}`},'GRANT',90,'rfp','keywords: grants','Builder Program',${extra.amount},'USDC',${extra.deadline},${created})`;
  const candidate = (ref: string, n: number, text: string) => ({ refId: ref, forumUrl: source, protocol: 'Revalidation fixture', title: `Builder grants round ${n}`,
    url: `${source}/t/round/${n}`, tags: [], body: text, createdAt: created, bumpedAt: created, signal: 'keywords: grants' });

  // Grounded legacy values survive the takeover.
  await insertLegacy('fields-legacy', 8, { deadline: deadline.toISOString(), amount: 25000 });
  await runNativeCandidateScan([candidate('fields-legacy', 8, body)], 10, classifier);
  const kept = (await db`SELECT signal, program, amount_max, currency, deadline FROM grants_items WHERE topic_ref_id='fields-legacy'`)[0];
  assert.equal(kept.signal, 'intelligence-reviewed:funding');
  assert.deepEqual([kept.program, Number(kept.amount_max), kept.currency, kept.deadline?.toISOString().slice(0, 10)], ['Builder Program', 25000, 'USDC', deadline.toISOString().slice(0, 10)]);

  // Ungrounded legacy values (an amount and deadline the post never states) are dropped, not reinstated.
  await insertLegacy('fields-legacy-stale', 18, { deadline: new Date(Date.now() + 9 * 86400000).toISOString(), amount: 90000 });
  await runNativeCandidateScan([candidate('fields-legacy-stale', 18, quote)], 10, classifier);
  const dropped = (await db`SELECT program, amount_max, currency, deadline FROM grants_items WHERE topic_ref_id='fields-legacy-stale'`)[0];
  assert.deepEqual([dropped.program, dropped.amount_max, dropped.currency, dropped.deadline], [null, null, null, null]);
});

test('a native re-approval without a deadline overwrites the previous one', { skip: !testUrl }, async () => {
  const db = getDb();
  const created = new Date(Date.now() - 60_000).toISOString();
  const deadline = new Date(Date.now() + 25 * 86400000);
  const human = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const withDeadline: CorpusClassify = async input => ({ model: 'fixture-fields', extraction: validateCorpusExtraction({
    relevant: input.lane === 'funding', kind: input.lane === 'funding' ? 'open_call' : 'other', availability: 'open', engagement: null,
    paidEvidence: false, confidence: 95, evidence: quote, applicationUrl: null, deadline: deadline.toISOString().slice(0, 10) }, input) });
  const post = { refId: 'fields-rolling', forumUrl: source, protocol: 'Revalidation fixture', title: 'Builder grants round 11',
    url: `${source}/t/round/11`, tags: [], body: `${quote} Applications close ${human}.`, createdAt: created, bumpedAt: created, signal: 'keywords: grants' };
  await runNativeCandidateScan([post], 10, withDeadline);
  assert.notEqual((await db`SELECT deadline FROM grants_items WHERE title='Builder grants round 11'`)[0].deadline, null);
  // The author edits it to a rolling call: the re-approval carries no deadline, and the row must say so.
  await runNativeCandidateScan([{ ...post, title: 'Builder grants round 11 (rolling)', body: `${quote} Rolling applications.` }], 10, classifier);
  assert.equal((await db`SELECT deadline FROM grants_items WHERE title='Builder grants round 11 (rolling)'`)[0].deadline, null);
});

test('a grounded deadline that passes withdraws the record as expired', { skip: !testUrl }, async () => {
  const db = getDb();
  const created = new Date(Date.now() - 60_000).toISOString(); // fresh, so the policy auto-approves it
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const human = new Date(`${tomorrow}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dated: CorpusClassify = async input => ({ model: 'fixture-fields', extraction: validateCorpusExtraction({
    relevant: input.lane === 'funding', kind: input.lane === 'funding' ? 'open_call' : 'other', availability: 'open', engagement: null,
    paidEvidence: false, confidence: 95, evidence: quote, applicationUrl: null, deadline: tomorrow }, input) });
  await runNativeCandidateScan([{ refId: 'fields-expiring', forumUrl: source, protocol: 'Revalidation fixture', title: 'Builder grants round 12',
    url: `${source}/t/round/12`, tags: [], body: `${quote} Applications close ${human}.`, createdAt: created, bumpedAt: created, signal: 'keywords: grants' }], 10, dated);
  const id = Number((await db`SELECT id FROM intelligence_documents WHERE ref_id='fields-expiring'`)[0].id);
  assert.equal((await db`SELECT review_state FROM funding_records WHERE document_id=${id}`)[0].review_state, 'approved');
  // Three days on, the deadline has passed: the sweep withdraws it, labelled as an expiry rather than a guard catch.
  const real = Date.now;
  Date.now = () => real() + 3 * 86400000;
  try { await revalidatePublished(); } finally { Date.now = real; }
  const audit = await db`SELECT reason FROM intelligence_reviews WHERE document_id=${id} AND action='withdraw'`;
  assert.equal(audit.length, 1); assert.match(audit[0].reason, /^expired: /);
});

test('a grants-category call ingested as historical is corrected and published (Rocket Pool Round 42)', { skip: !testUrl }, async () => {
  const db = getDb();
  const { ingestDocuments } = await import('../src/lib/intelligenceStore');
  const { publishPendingFresh } = await import('../src/lib/publishRevalidation');
  await db`UPDATE intelligence_settings SET value=jsonb_build_object('at',now()-interval '4 days') WHERE name='native-cutover'`; // prod: Oct 5
  const posted = new Date(Date.now() - 41 * 3600000).toISOString(); // posted 41h ago, first seen shortly after
  const old = new Date(Date.now() - 400 * 86400000).toISOString();
  const doc = (ref: string, title: string, createdAt: string) => ({ refId: ref, sourceKey: source, url: `${source}/t/${ref}/1`, title, body: quote, createdAt, historical: true, evidenceScope: 'discourse_surface_first_post' });
  // The surface path used to flag every item historical, whatever its date.
  await ingestDocuments([doc('round-42-grants', 'Round 42 - GMC Call for Grant Applications', posted), doc('old-round', 'Round 9 - GMC Call for Grant Applications', old)]);
  const flag = async (ref: string) => (await db`SELECT historical FROM intelligence_documents WHERE ref_id=${ref}`)[0].historical;
  assert.equal(await flag('round-42-grants'), true);
  // It is classified while still flagged, so the fresh policy leaves it pending.
  const id = Number((await db`SELECT id FROM intelligence_documents WHERE ref_id='round-42-grants'`)[0].id);
  const { classifyIntelligenceDocument, publishFreshIntelligence } = await import('../src/lib/intelligenceStore');
  await classifyIntelligenceDocument(id, 'funding', classifier); await publishFreshIntelligence(id, 'funding');
  assert.equal((await db`SELECT review_state FROM funding_records WHERE document_id=${id}`)[0].review_state, 'pending');
  // A backfill or probe re-observing it (historical:true on purpose) never clears the flag (PR #99 review).
  await ingestDocuments([doc('round-42-grants', 'Round 42 - GMC Call for Grant Applications', posted)]);
  assert.equal(await flag('round-42-grants'), true);
  // A live observation (historical:false, from its date) corrects it; an old topic stays historical.
  const live = (ref: string, title: string, createdAt: string) => ({ ...doc(ref, title, createdAt), historical: false, evidenceScope: 'source_candidate_body' });
  await ingestDocuments([live('round-42-grants', 'Round 42 - GMC Call for Grant Applications', posted), live('old-round', 'Round 9 - GMC Call for Grant Applications', old)]);
  assert.equal(await flag('round-42-grants'), false);
  assert.equal(await flag('old-round'), true);
  // The maintenance catch-up publishes it, and only it.
  const released = await publishPendingFresh();
  assert.equal(released.published, 1);
  assert.equal((await db`SELECT review_state, reviewed_by FROM funding_records WHERE document_id=${id}`)[0].review_state, 'approved');
  assert.equal((await publishPendingFresh()).published, 0);
});
