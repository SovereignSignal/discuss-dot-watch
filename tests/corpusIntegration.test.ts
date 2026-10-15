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

import { importMagnumThreads, drainThreadQueue, type MagnumFetch } from '../src/lib/forumMagnumThreads';
test('writing corpus: ForumMagnum top posts become documents and their comments are drained by the ticker', { skip: !testUrl }, async () => {
  await initializeCorpusSchema();
  const db = getDb();
  const post = (id: string, score: number) => ({ _id: id, title: `EA post ${id}`, slug: `ea-${id}`, postedAt: '2026-09-12T05:03:06Z', modifiedAt: '2026-09-13T00:00:00Z', baseScore: score, voteCount: 10, commentCount: 2, tags: [{ name: 'Funding' }], user: { displayName: 'Author' }, contents: { html: `<p>Body of ${id} asking for $40,000.</p>` } });
  const calls: string[] = [];
  const fetch: MagnumFetch = async (endpoint, query) => {
    calls.push(query);
    assert.equal(endpoint, 'https://forum.effectivealtruism.org/graphql');
    if (query.includes('posts(')) return { data: { posts: { results: [post('magA1', 50), post('magB2', 90)] } } };
    const id = /postId:"(\w+)"/.exec(query)![1];
    if (id === 'magA1') { const { CorpusError } = await import('../src/lib/corpusPolicy'); throw new CorpusError('upstream_500'); }
    return { data: { comments: { results: [
      { _id: 'cm1', parentCommentId: null, postedAt: '2026-09-13T00:00:00Z', baseScore: 12, user: { displayName: 'Delegate' }, contents: { html: '<p>What is the budget?</p>' } },
      { _id: 'cm2', parentCommentId: 'cm1', postedAt: '2026-09-13T01:00:00Z', baseScore: 3, user: { displayName: 'Author' }, contents: { html: '<p>$40,000 over six months.</p>' } },
    ] } } };
  };
  const imported = await importMagnumThreads('ea-forum', '2026-09-01T00:00:00Z', 10, fetch);
  assert.deepEqual(imported, { source: 'ea-forum', posts: 2, queued: 2 });
  // Replaying the import upgrades the same documents; it never creates a second row.
  await importMagnumThreads('ea-forum', '2026-09-01T00:00:00Z', 10, fetch);
  const docs = await db`SELECT ref_id, body_status, historical, evidence_scope FROM intelligence_documents WHERE ref_id IN ('ea-forum:magA1','ea-forum:magB2') ORDER BY ref_id`;
  assert.deepEqual(docs.map(d => [d.ref_id, d.body_status, d.historical, d.evidence_scope]), [['ea-forum:magA1', 'fetched', true, 'native_ea-forum'], ['ea-forum:magB2', 'fetched', true, 'native_ea-forum']]);
  // Highest score first; a failed thread is marked and not retried in the same pass.
  const drained = await drainThreadQueue(3, fetch);
  assert.deepEqual(drained, { claimed: 2, fetched: 1, failed: 1 });
  const queue = await db`SELECT q.post_id, q.status, q.error, q.fetched_comments FROM document_thread_queue q ORDER BY q.score DESC`;
  assert.deepEqual(queue.map(q => [q.post_id, q.status, q.error, q.fetched_comments]), [['magB2', 'fetched', null, 2], ['magA1', 'failed', 'upstream_500', null]]);
  const comments = await db`SELECT c.comment_id, c.parent_comment_id, c.username, c.body_text, c.score FROM document_comments c JOIN intelligence_documents d ON d.id = c.document_id WHERE d.ref_id = 'ea-forum:magB2' ORDER BY c.comment_id`;
  assert.deepEqual(comments.map(c => [c.comment_id, c.parent_comment_id, c.username, c.body_text, Number(c.score)]), [['cm1', null, 'Delegate', 'What is the budget?', 12], ['cm2', 'cm1', 'Author', '$40,000 over six months.', 3]]);
  // Nothing left to claim: a no-op, and imports never arm the mail path.
  assert.deepEqual(await drainThreadQueue(3, fetch), { claimed: 0, fetched: 0, failed: 0 });
  assert.equal(Number((await db`SELECT count(*)::int AS n FROM intelligence_evaluations e JOIN intelligence_documents d ON d.id = e.document_id WHERE d.ref_id LIKE 'ea-forum:mag%' AND e.notify`)[0].n), 0);
});

import { buildCommunityCard, writingContext, listCommunityCards } from '../src/lib/writingContext';
test('writing corpus: a community card is built from stored threads and the context endpoint picks exemplars for a brief', { skip: !testUrl }, async () => {
  const db = getDb();
  // Seed a Discourse community: ten fetched proposal threads in category 5 on the pilot forum, two with replies.
  const forum = (await db`SELECT id FROM forums WHERE url = 'https://forum.dfinity.org/'`)[0];
  for (let i = 1; i <= 10; i++) {
    const hot = i >= 8;
    const t = (await db`INSERT INTO topics (forum_id, discourse_id, title, slug, category_id, tags, created_at, bumped_at, reply_count, like_count, views)
      VALUES (${forum.id}, ${920000 + i}, ${hot ? `Proposal: treasury grant ${i}` : `Proposal: small change ${i}`}, ${`p-${i}`}, 7, '{}', now() - ${i} * interval '1 day', now(), ${hot ? 30 + i : i % 3}, ${hot ? 20 : 1}, 100)
      ON CONFLICT (forum_id, discourse_id) DO UPDATE SET title = EXCLUDED.title RETURNING id`)[0];
    await db`INSERT INTO topic_documents (topic_id, source_key, title, body_text, fetch_status, fetched_at) VALUES (${t.id}, 'internet-computer', ${`Proposal ${i}`},
      ${hot ? `Summary: we request a treasury grant of ${i * 10}k for liquidity tooling. Budget: ${i * 10}k. Timeline: 3 months. ` + 'detail '.repeat(200) : `Summary: a small change to parameter ${i}. ` + 'detail '.repeat(40)}, 'fetched', now())
      ON CONFLICT (topic_id) DO UPDATE SET body_text = EXCLUDED.body_text, fetch_status = 'fetched', fetched_at = now()`;
    if (hot) for (const [n, body, score] of [[2, 'What is the budget breakdown and who owns delivery?', 12], [3, 'Would a smaller pilot work first?', 4]] as const)
      await db`INSERT INTO topic_posts (topic_id, post_number, source_post_id, username, body_text, score, reads, created_at) VALUES (${t.id}, ${n}, ${920000 * 10 + i * 10 + n}, 'delegate', ${body}, ${score}, 50, now()) ON CONFLICT DO NOTHING`;
  }
  const spec = { key: 'icp', genre: 'proposal', name: 'Internet Computer', discourse: { origin: 'https://forum.dfinity.org', categoryIds: [7] } };
  let cardPromptSeen = '';
  const card = await buildCommunityCard(spec, {
    generateStructured: (async () => ({ model: 'fixture-structured', output: { objections: [{ text: 'Budget breakdown and delivery owner', count: 2, example: 'who owns delivery' }] } })) as never,
    generateText: (async (req: { prompt: string }) => { cardPromptSeen = req.prompt; return '## What this community expects\nShort asks with a budget line.\n## Structure that gets engaged with\nSummary, Budget, Timeline.\n## What readers will ask\nWho owns delivery.\n## Pitfalls seen here\nNo timeline.'; }) as never,
  });
  assert.equal(card.stats.threads, 10);
  assert.equal(card.stats.topTier.threads, 2);
  assert.deepEqual(card.objections, [{ text: 'Budget breakdown and delivery owner', count: 2, example: 'who owns delivery' }]);
  assert.match(card.card, /^# Internet Computer: proposal\n_10 threads/);
  assert.match(card.card, /## Pitfalls seen here/);
  assert.match(cardPromptSeen, /### Proposal: treasury grant 10 \(40 replies/);
  assert.equal(card.exemplars[0].tier, 'top');
  assert.deepEqual((await listCommunityCards()).map(c => [c.key, c.genre, c.threads, c.model]), [['icp', 'proposal', 10, 'fixture-structured']]);
  // Brief-driven retrieval finds the grant threads; an unrelated brief falls back to engagement order.
  const ctx = await writingContext('icp', 'proposal', 'We want a treasury grant for liquidity tooling');
  assert.ok(ctx);
  assert.equal(ctx!.retrieval, 'brief');
  assert.ok(ctx!.exemplars.length >= 3);
  assert.match(ctx!.exemplars[0].title, /treasury grant/);
  assert.equal(ctx!.exemplars[0].posts[0].body, 'What is the budget breakdown and who owns delivery?');
  assert.ok(ctx!.exemplars[0].body.length <= 6000);
  const fallback = await writingContext('icp', 'proposal', 'zzz qqq');
  assert.equal(fallback!.retrieval, 'engagement');
  assert.ok(fallback!.exemplars.every(e => e.tier === 'top'));
  assert.equal(await writingContext('icp', 'missing'), null);
  await assert.rejects(() => writingContext('Bad Key', 'proposal'), /invalid_community_spec/);
  await assert.rejects(() => buildCommunityCard({ key: 'empty', genre: 'proposal', name: 'Empty', discourse: { origin: 'https://forum.livepeer.org', categoryIds: [999] } }, { generateText: (async () => '') as never, generateStructured: (async () => null) as never }), /corpus_too_small/);
});

import { judgeSubmit, judgeCollect, judgeStatus, strongestWriting } from '../src/lib/writingQuality';
test('writing quality: submit gates on budget, collect verifies passages and builds the exemplar bank', { skip: !testUrl }, async () => {
  const db = getDb();
  // Mock Batch API: records the submitted requests and returns a judgement per thread.
  const submitted: Array<{ custom_id: string; params: { messages: Array<{ content: string }> } }> = [];
  const api = {
    create: async ({ requests }: { requests: typeof submitted }) => { submitted.push(...requests); return { id: 'msgbatch_test1', processing_status: 'in_progress' }; },
    retrieve: async (id: string) => ({ id, processing_status: 'ended', request_counts: { succeeded: submitted.length, errored: 0, processing: 0, canceled: 0, expired: 0 } }),
    results: async () => (async function* () {
      for (const [i, r] of submitted.entries()) {
        const post = /OPENING POST:\n([\s\S]*?)\n\nREPLIES/.exec(r.params.messages[0].content)![1];
        const passage = i === 0 ? post.slice(0, 60).trim() : 'this sentence is not in the post';
        yield { custom_id: r.custom_id, result: { type: 'succeeded', message: { content: [{ type: 'tool_use', id: 't', name: 'record_scores',
          input: { clarity: 4, argument: 5, evidence: 4, concision: 4, disagreement: 3, overall: i === 0 ? 5 : 4, moves: ['opening-a-case'], best_passage: passage, reason: 'Clear ask.' } }],
          usage: { input_tokens: 1000, output_tokens: 200 } } } };
      }
    })(),
  };
  const dry = await judgeSubmit({ model: 'claude-haiku-5-5', maxUsd: 1, dryRun: true }, api as never);
  assert.equal(dry.submitted, false); assert.ok(dry.threads! >= 3, `threads ${dry.threads}`); assert.ok(dry.estimate!.usd < 1);
  await assert.rejects(() => judgeSubmit({ model: 'claude-opus-5-5', maxUsd: 0.0001 }, api as never), /judge_over_budget/);
  assert.equal(submitted.length, 0);
  const sub = await judgeSubmit({ model: 'claude-haiku-5-5', maxUsd: 1 }, api as never);
  assert.equal(sub.submitted, true); assert.equal(sub.batchId, 'msgbatch_test1'); assert.equal(submitted.length, sub.threads);
  // The seeded EA posts are under the 400-character floor, so only Discourse threads qualify here.
  assert.ok(submitted.every(r => /^discourse-\d+$/.test(r.custom_id)) && submitted.length >= 3, 'discourse threads over the length floor are judged, with batch-safe ids');
  const collected = await judgeCollect('msgbatch_test1', api as never);
  assert.equal(collected.ended, true); assert.equal(collected.succeeded, submitted.length); assert.equal(collected.errored, 0);
  const rows = await db`SELECT thread_key, overall, passage_found FROM writing_scores WHERE model = 'claude-haiku-5-5' ORDER BY thread_key`;
  assert.equal(rows.length, submitted.length);
  assert.equal(rows.filter(r => r.passage_found).length, 1, 'only the real quote is verified');
  const status = await judgeStatus();
  assert.equal(status.batches![0].status, 'ended');
  assert.equal(Number(status.scores![0].scored), submitted.length);
  const bank = await strongestWriting({ model: 'claude-haiku-5-5' });
  assert.equal(bank.length, 1, 'bank requires a verified passage');
  assert.equal(bank[0].custom_id, undefined);
  // Nothing left to judge for this model; a second submit is a no-op.
  assert.deepEqual(await judgeSubmit({ model: 'claude-haiku-5-5', maxUsd: 1 }, api as never), { submitted: false, reason: 'nothing_to_judge', threads: 0 });
});

import { writingExemplars } from '../src/lib/writingQuality';
test('writing exemplars: strong verified passages by move and by overlap with a draft', { skip: !testUrl }, async () => {
  const db = getDb();
  // Promote two judged rows to strong with distinct moves; the judge test above left exactly one verified row.
  const keys = await db`SELECT thread_key FROM writing_scores WHERE model = 'claude-haiku-5-5' ORDER BY thread_key LIMIT 3`;
  await db`UPDATE writing_scores SET overall = 5, passage_found = true, best_passage = 'Summary: we request a treasury grant', moves = '{opening-a-case,sizing-an-ask}' WHERE thread_key = ${keys[0].thread_key}`;
  await db`UPDATE writing_scores SET overall = 4, passage_found = true, best_passage = 'a small change to parameter', moves = '{answering-objections}' WHERE thread_key = ${keys[1].thread_key}`;
  const byMove = await writingExemplars({ moves: ['sizing-an-ask'], perMove: 2, byOverlap: 0 });
  assert.equal(byMove.length, 1); assert.equal(byMove[0].threadKey, keys[0].thread_key); assert.ok(byMove[0].opening.length > 0);
  const byOverlap = await writingExemplars({ moves: [], text: 'We want a treasury grant for liquidity tooling with a budget', byOverlap: 3 });
  assert.ok(byOverlap.some(h => h.threadKey === keys[0].thread_key)); assert.ok(byOverlap[0].matchedTerms >= 2);
  const both = await writingExemplars({ moves: ['answering-objections', 'sizing-an-ask'], text: 'treasury grant budget', perMove: 1, byOverlap: 1 });
  assert.ok(both.length >= 2 && new Set(both.map(h => h.threadKey)).size === both.length, 'deduplicated across move and overlap picks');
  const fallback = await writingExemplars({ moves: ['summarising'], text: 'zzz' });
  assert.ok(fallback.length >= 1, 'falls back to the strongest rows when nothing matches');
});
