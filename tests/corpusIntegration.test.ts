import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, initializeSchema } from '../src/lib/db';
import { initializeCorpusSchema, startCorpusJob, pauseCorpusJob, resumeCorpusJob, searchCorpus, corpusStatus } from '../src/lib/corpusStore';
import { runCorpusTick, type CorpusFetch } from '../src/lib/corpusWorker';
import { classifyCorpusTopic, validateCorpusExtraction } from '../src/lib/corpusClassifier';
import { initializeCorpusPromotionSchema, promoteCorpusTopic, withdrawCorpusPromotion } from '../src/lib/corpusPromotion';
import { PILOT_SOURCES } from '../src/lib/corpusPolicy';

// Dedicated ephemeral CI database only. Never set this variable to a production URL.
const testUrl = process.env.CORPUS_TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
after(async () => { if (testUrl) await getDb().end({ timeout: 5 }); });

test('corpus PostgreSQL pilot: checkpoint, replay, search, leases, independent lanes and failures', { skip: !testUrl }, async () => {
  await initializeSchema();
  await initializeCorpusSchema();
  await initializeCorpusSchema();
  await initializeCorpusPromotionSchema();
  await initializeCorpusPromotionSchema();
  const db = getDb();
  for (const s of PILOT_SOURCES) await db`INSERT INTO forums (url, name, category, tier) VALUES (${s.origin + '/'}, ${s.name}, 'crypto', 2) ON CONFLICT (url) DO NOTHING`;
  const asOf = new Date().toISOString();
  const date = (days: number) => new Date(Date.parse(asOf) - days * 86_400_000).toISOString();
  const topic = (id: number, days: number, title: string) => ({ id, title, slug: `topic-${id}`, tags: ['pilot'], category_id: 2, created_at: date(days), bumped_at: date(days), pinned: false });
  const first = topic(900011, 1, 'Engine reference');
  const second = topic(900012, 2, 'Work bulletin');
  const old = topic(900013, 10, 'Outside the window');
  const paidBody = 'We are hiring a Rust developer for a paid six-week contract.';
  let calls = 0;
  const fetch: CorpusFetch = async url => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 10));
    if (url.includes('/latest.json')) return { topic_list: { topics: [first, second, old], more_topics_url: '/latest.json?page=1' } };
    const t = url.includes('900011') ? first : second;
    return { ...t, post_stream: { posts: [{ id: t.id + 100, post_number: 1, cooked: t.id === first.id ? '<p>Heliotrope checksum appears only inside this body.</p>' : `<p>${paidBody}</p>`, created_at: t.created_at }] } };
  };
  const job = await startCorpusJob('internet-computer', 7, asOf);
  assert.equal(await startCorpusJob('internet-computer', 7, asOf), job);
  const parallel = await Promise.all([runCorpusTick(job, fetch), runCorpusTick(job, fetch)]);
  assert.equal(parallel.filter(r => r.worked).length, 1);
  assert.equal(calls, 1);
  let state = await corpusStatus();
  assert.equal(state.jobs.find(j => j.id === job)?.phase, 'bodies');
  assert.equal(Number(state.jobs.find(j => j.id === job)?.discovered), 2);
  await pauseCorpusJob(job);
  assert.equal((await runCorpusTick(job, fetch)).worked, false);
  await resumeCorpusJob(job);
  // Simulate an abandoned process lease; a new tick must reclaim it.
  await db`UPDATE corpus_jobs SET status = 'running', lease_token = '00000000-0000-4000-8000-000000000001', lease_until = now() - interval '1 minute' WHERE id = ${job}`;
  await runCorpusTick(job, fetch);
  state = await corpusStatus();
  assert.equal(state.jobs.find(j => j.id === job)?.status, 'complete');
  assert.equal(calls, 3);
  assert.equal((await runCorpusTick(job, fetch)).worked, false);
  assert.equal(calls, 3);
  const result = await searchCorpus('heliotrope', 'internet-computer');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'Engine reference');
  assert.equal(result.items[0].title.toLowerCase().includes('heliotrope'), false);
  const work = (await searchCorpus('hiring', 'internet-computer')).items[0];
  assert.ok(work);
  let modelCalls = 0;
  const classifier = async (input: Parameters<typeof validateCorpusExtraction>[1]) => {
    modelCalls++;
    return { model: 'fixture-model', extraction: validateCorpusExtraction({ relevant: true,
      kind: input.lane === 'opportunities' ? 'paid_work' : 'other', availability: 'open', engagement: 'contract',
      paidEvidence: true, confidence: 95, evidence: paidBody, deadline: null, applicationUrl: null }, input) };
  };
  await classifyCorpusTopic(work.topicId, 'opportunities', classifier);
  await classifyCorpusTopic(work.topicId, 'funding', classifier);
  assert.equal((await classifyCorpusTopic(work.topicId, 'opportunities', classifier)).worked, false);
  assert.equal(modelCalls, 2);
  const classified = (await searchCorpus('hiring', 'internet-computer')).items[0];
  assert.equal(classified.classifications.length, 2);
  const promoted = await promoteCorpusTopic(work.topicId, 'opportunities');
  assert.equal(promoted.promoted, true);
  assert.equal(promoted.classification, 'ROLE');
  assert.equal(promoted.kind, 'contract');
  const liveRows = await db`SELECT topic_ref_id, classification, kind, status, notified_at FROM grants_items WHERE topic_ref_id = ${promoted.grantsRefId}`;
  assert.equal(liveRows.length, 1);
  assert.equal(liveRows[0].classification, 'ROLE');
  assert.equal(liveRows[0].kind, 'contract');
  assert.equal(liveRows[0].status, 'open');
  assert.ok(liveRows[0].notified_at);
  await assert.rejects(() => promoteCorpusTopic(work.topicId, 'funding'), /classification_not_promotable/);
  const replayPromotion = await promoteCorpusTopic(work.topicId, 'opportunities');
  assert.equal(replayPromotion.grantsRefId, promoted.grantsRefId);
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM grants_items WHERE topic_ref_id = ${promoted.grantsRefId}`)[0].n), 1);
  await withdrawCorpusPromotion(work.topicId, 'opportunities');
  assert.equal((await db`SELECT status FROM grants_items WHERE topic_ref_id = ${promoted.grantsRefId}`)[0].status, 'closed');
  const notify = await db`SELECT count(*)::int AS n FROM topic_documents WHERE notify = true`;
  assert.equal(notify[0].n, 0);
  const original = (await db`SELECT fetched_at, content_hash FROM topic_documents WHERE topic_id = ${result.items[0].topicId}`)[0];
  // Re-fetch in a second explicit window. A 404 hides the result without inventing freshness or deleting history.
  const secondJob = await startCorpusJob('internet-computer', 30, asOf);
  const failedFetch: CorpusFetch = async url => {
    if (url.includes('/latest.json')) return { topic_list: { topics: [first], more_topics_url: '' } };
    const { CorpusError } = await import('../src/lib/corpusPolicy');
    throw new CorpusError('upstream_404');
  };
  await runCorpusTick(secondJob, failedFetch);
  await runCorpusTick(secondJob, failedFetch);
  assert.equal((await corpusStatus()).jobs.find(j => j.id === secondJob)?.status, 'partial');
  assert.equal((await searchCorpus('heliotrope')).items.length, 0);
  const retained = (await db`SELECT fetched_at, content_hash FROM topic_documents WHERE topic_id = ${result.items[0].topicId}`)[0];
  assert.equal(retained.content_hash, original.content_hash);
  assert.equal(retained.fetched_at.toISOString(), original.fetched_at.toISOString());
  await resumeCorpusJob(secondJob);
  await runCorpusTick(secondJob, fetch);
  assert.equal((await searchCorpus('heliotrope')).items.length, 1);
  // Repeated pages never claim full historical coverage.
  const stuckJob = await startCorpusJob('livepeer', 7, asOf);
  const repeated: CorpusFetch = async () => ({ topic_list: { topics: [first], more_topics_url: '/latest.json?page=1' } });
  await runCorpusTick(stuckJob, repeated);
  const stuck = await runCorpusTick(stuckJob, repeated);
  assert.equal('error' in stuck ? stuck.error : null, 'repeated_page');
  assert.equal((await corpusStatus()).jobs.find(j => j.id === stuckJob)?.range_complete, false);
  // A quiet forum with a valid cutoff page is truthfully complete with zero bodies.
  const emptyJob = await startCorpusJob('radworks', 7, asOf);
  await runCorpusTick(emptyJob, async () => ({ topic_list: { topics: [old], more_topics_url: '/latest.json?page=1' } }));
  await runCorpusTick(emptyJob, fetch);
  assert.equal((await corpusStatus()).jobs.find(j => j.id === emptyJob)?.status, 'complete');
  console.log('CORPUS_INTEGRATION_PROOF ' + JSON.stringify({ bodyOnlySearch: true, duplicateFreeReplay: true, leaseRecovery: true, independentLaneRows: 2, controlledPromotion: true, historicalEmailSuppression: true, notifications: 0, deletionFreshnessPreserved: true }));
});

import { tickPendingCorpusJob } from '../src/lib/corpusWorker';
test('writing corpus: category-scoped job keeps thread replies from the same fetch and the loop drives it', { skip: !testUrl }, async () => {
  await initializeCorpusSchema();
  const db = getDb();
  const asOf = new Date().toISOString();
  const created = new Date(Date.parse(asOf) - 86_400_000).toISOString();
  const topicRow = { id: 910001, title: 'Proposal: fund the thing', slug: 'proposal-fund', tags: [], category_id: 5, created_at: created, bumped_at: created, pinned: false };
  const post = (post_number: number, extra: Record<string, unknown> = {}) => ({ id: 5000 + post_number, post_number, username: `delegate${post_number}`, cooked: `<p>Reply ${post_number}: what is the budget?</p>`, created_at: created, reply_to_post_number: post_number > 2 ? 2 : undefined, score: 3, reads: 9, ...extra });
  const urls: string[] = [];
  const fetch: CorpusFetch = async url => {
    urls.push(url);
    if (url.includes('/l/latest.json')) return { topic_list: { topics: [topicRow], more_topics_url: '' } };
    if (url.includes('/latest.json')) throw new Error('uncategorised listing must not be used for a category job');
    return { ...topicRow, post_stream: { stream: [5001, 5002, 5003, 5004, 5005, 5006, 5007], posts: [
      { id: 5001, post_number: 1, cooked: '<p>We propose to fund the thing with 40k.</p>', created_at: created },
      post(2), post(3), post(4, { hidden: true }), post(5, { post_type: 4 }),
    ] } };
  };
  const category = { id: 5, slug: 'proposal-discussion' };
  const job = await startCorpusJob('internet-computer', 7, asOf, { category });
  // Same window, different category (or none) is a different job; same category replays.
  assert.notEqual(await startCorpusJob('internet-computer', 7, asOf), job);
  assert.notEqual(await startCorpusJob('internet-computer', 7, asOf, { category: { id: 9, slug: 'temperature-check' } }), job);
  assert.equal(await startCorpusJob('internet-computer', 7, asOf, { category }), job);
  await assert.rejects(() => startCorpusJob('internet-computer', 7, asOf, { category: { id: 5, slug: 'Bad Slug' } }), /invalid_category/);
  // Pause the sibling jobs so the loop picks this one.
  await db`UPDATE corpus_jobs SET status = 'paused' WHERE id <> ${job} AND source_key = 'internet-computer' AND as_of = ${asOf}`;
  const first = await tickPendingCorpusJob(fetch);
  assert.ok(first && first.worked);
  assert.match(urls[0], /\/c\/proposal-discussion\/5\/l\/latest\.json\?order=created/);
  await db`UPDATE corpus_jobs SET lease_until = NULL WHERE id = ${job}`;
  await tickPendingCorpusJob(fetch);
  const status = (await corpusStatus()).jobs.find(j => j.id === job);
  assert.equal(status?.category_slug, 'proposal-discussion');
  assert.equal(Number(status?.fetched), 1);
  assert.equal(Number(status?.posts), 2);
  const posts = await db`SELECT p.post_number, p.username, p.body_text, p.reply_to, p.score, d.posts_total
    FROM topic_posts p JOIN topic_documents d ON d.topic_id = p.topic_id JOIN topics t ON t.id = p.topic_id
    WHERE t.discourse_id = 910001 ORDER BY p.post_number`;
  assert.deepEqual(posts.map(p => [p.post_number, p.username, p.reply_to]), [[2, 'delegate2', null], [3, 'delegate3', 2]]);
  assert.equal(posts[0].body_text, 'Reply 2: what is the budget?');
  assert.equal(posts[0].posts_total, 7);
  // Replies never enter the notification path: no topic_posts row has any route to grants_items.
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM topic_documents WHERE notify = true`)[0].n), 0);
  // No claimable job means the loop is a no-op, not an error.
  await db`UPDATE corpus_jobs SET status = 'paused' WHERE status IN ('pending','running')`;
  assert.equal(await tickPendingCorpusJob(fetch), null);
});
