import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { bulkUpsertTopics, getDb, initializeSchema, upsertForum } from '../src/lib/db';
import { ensureIntelligence, ingestDocuments } from '../src/lib/intelligenceStore';
import { observeSourceTopics } from '../src/lib/intelligenceWorker';
import { fetchDiscourseRssTopics } from '../src/lib/discourseRss';

// Dedicated ephemeral test database only, following existing integration fixtures.
const testUrl = process.env.CORPUS_TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
after(async () => { if (testUrl) await getDb().end({ timeout: 5 }); });

test('RSS persistence retains measured counters and moderation; later JSON can update them', { skip: !testUrl }, async () => {
  await initializeSchema();
  const forumId = await upsertForum({ url: 'https://rss-fixture.example/', name: 'RSS fixture', category: 'crypto' });
  const original = {
    discourseId: 21, title: 'Original topic', slug: 'original-topic', categoryId: 7, tags: ['grants'],
    postsCount: 6, views: 433, replyCount: 5, likeCount: 12, pinned: true, closed: true, archived: true,
    createdAt: '2026-10-01T00:00:00.000Z', bumpedAt: '2026-10-12T00:00:00.000Z',
  };
  await bulkUpsertTopics(forumId, [original]);
  await bulkUpsertTopics(forumId, [{ discourseId: 21, title: 'Fresh RSS title', slug: 'fresh-title', createdAt: original.createdAt, bumpedAt: original.createdAt }], { preserveUnreportedFields: true });
  const db = getDb();
  const [stored] = await db`SELECT * FROM topics WHERE forum_id=${forumId} AND discourse_id=21`;
  assert.equal(stored.title, 'Fresh RSS title');
  assert.equal(stored.slug, 'fresh-title');
  assert.equal(stored.views, 433);
  assert.equal(stored.posts_count, 6);
  assert.equal(stored.reply_count, 5);
  assert.equal(stored.like_count, 12);
  assert.equal(stored.category_id, 7);
  assert.deepEqual(stored.tags, ['grants']);
  assert.equal(stored.pinned, true);
  assert.equal(stored.closed, true);
  assert.equal(stored.archived, true);
  assert.equal(stored.bumped_at.toISOString(), original.bumpedAt);
  await bulkUpsertTopics(forumId, [{ ...original, views: 500, closed: false, bumpedAt: '2026-10-15T00:00:00.000Z' }]);
  const [recovered] = await db`SELECT views, closed, bumped_at FROM topics WHERE forum_id=${forumId} AND discourse_id=21`;
  assert.equal(recovered.views, 500);
  assert.equal(recovered.closed, false);
  assert.equal(recovered.bumped_at.toISOString(), '2026-10-15T00:00:00.000Z');
});

test('RSS corpus observations preserve verified body and unreported source state across a cold cache', { skip: !testUrl }, async () => {
  await initializeSchema();
  await ensureIntelligence();
  const db = getDb();
  const source = 'https://rss-corpus-fixture.example';
  await db`INSERT INTO ingestion_sources(source_key,name,url,adapter,vertical,enabled,managed_by) VALUES(${source},'RSS corpus fixture',${source},'discourse','crypto',true,'fixture') ON CONFLICT DO NOTHING`;
  const createdAt = '2026-10-01T00:00:00.000Z';
  const updatedAt = '2026-10-12T00:00:00.000Z';
  const verifiedAt = new Date(Date.now() - 2 * 86_400_000);
  await ingestDocuments([{
    refId: 'rss-corpus-fixture-21', sourceKey: source, url: `${source}/t/topic/21`,
    title: 'Grant round', body: 'The verified first post has the complete grant terms.',
    tags: ['grants'], createdAt, updatedAt, closed: true, hidden: true,
    bodyStatus: 'fetched', historical: true, evidenceScope: 'discourse_first_post',
  }]);
  await db`UPDATE intelligence_documents SET verified_at=${verifiedAt} WHERE ref_id='rss-corpus-fixture-21'`;
  const read = async () => (await db`SELECT * FROM intelligence_documents WHERE ref_id='rss-corpus-fixture-21'`)[0];
  const before = await read();
  const xml = `<rss version="2.0"><channel><item><title>Grant round</title><link>${source}/t/topic/21</link><pubDate>${createdAt}</pubDate><description>Short excerpt. 3 posts - 2 participants Read full topic</description></item><item><title>New topic</title><link>${source}/t/new-topic/22</link><pubDate>${createdAt}</pubDate><description>First available source text.</description></item></channel></rss>`;
  // No previous memory cache: the adapter must produce unknown-state display defaults.
  const rss = await fetchDiscourseRssTopics({ name: 'RSS corpus fixture', url: source, tier: 1 }, [], async () => new Response(xml));
  assert.equal(rss.error, undefined);
  assert.equal(rss.topics[0].closed, false);
  assert.equal(rss.topics[0].visible, true);
  await observeSourceTopics(source, rss.topics, 'discourse_latest_rss_first_post');
  const after = await read();
  assert.equal(after.source_closed, true);
  assert.equal(after.hidden, true);
  assert.equal(after.source_updated_at.toISOString(), updatedAt);
  assert.equal(after.body, before.body);
  assert.equal(after.body_status, 'fetched');
  assert.equal(after.content_hash, before.content_hash);
  assert.equal(after.evidence_scope, 'discourse_first_post');
  assert.equal(after.verified_at.toISOString(), verifiedAt.toISOString(), 'ignored excerpts must not postpone body reverification');
  assert.equal((await db`SELECT body FROM intelligence_documents WHERE ref_id='rss-corpus-fixture-22'`)[0].body, 'First available source text.');
  // RSS-only bodies remain useful: a second feed observation can replace its own text.
  // Metadata-only passes must retain the provenance needed to make that distinction.
  await observeSourceTopics(source, [{ ...rss.topics[1], metadataSource: undefined, firstPostText: undefined }], 'discourse_topic_metadata');
  await observeSourceTopics(source, rss.topics.map(t => ({ ...t, firstPostText: 'Applications now close on November 30.' })), 'discourse_latest_rss_first_post');
  const rssOnly = (await db`SELECT body,evidence_scope,body_status FROM intelligence_documents WHERE ref_id='rss-corpus-fixture-22'`)[0];
  assert.equal(rssOnly.body, 'Applications now close on November 30.');
  assert.equal(rssOnly.evidence_scope, 'discourse_latest_rss_first_post');
  assert.equal(rssOnly.body_status, 'fetched', 'RSS text remains available to the existing classifier');
  assert.equal((await read()).body, before.body, 'repeated RSS still cannot replace stronger body evidence');
  // A later real topic observation still updates authoritative moderation and activity.
  await observeSourceTopics(source, [{ ...rss.topics[0], metadataSource: undefined, firstPostText: before.body, bumpedAt: '2026-10-15T00:00:00.000Z' }], 'discourse_topic_metadata');
  const recovered = await read();
  assert.equal(recovered.source_closed, false);
  assert.equal(recovered.hidden, false);
  assert.equal(recovered.source_updated_at.toISOString(), '2026-10-15T00:00:00.000Z');
  assert.ok(recovered.verified_at > verifiedAt);
  // Before this fix, legacy feed refreshes could stamp their scope onto a retained
  // JSON body. That ambiguous legacy scope must not weaken the existing protection.
  await db`UPDATE intelligence_documents SET evidence_scope='discourse_surface_first_post' WHERE ref_id='rss-corpus-fixture-21'`;
  await observeSourceTopics(source, [rss.topics[0]], 'discourse_latest_rss_first_post');
  assert.equal((await read()).body, before.body);
  assert.equal((await read()).evidence_scope, 'discourse_surface_first_post');
});
