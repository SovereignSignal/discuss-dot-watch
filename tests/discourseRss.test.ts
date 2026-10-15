import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { fetchDiscourseRssTopics } from '../src/lib/discourseRss';
import { FORUM_CATEGORIES } from '../src/lib/forumPresets';
import { forumCacheAfterFetch, getCachedForum, getForumHealthFromCache, type CachedForum } from '../src/lib/forumCache';
import { GET } from '../src/app/api/discourse/route';
import type { DiscussionTopic } from '../src/types';

// These tests exercise local state and injected HTTP responses only.
delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;
const forum = FORUM_CATEGORIES.flatMap(c => c.forums).find(f => f.name === 'Celestia')!;
const key = forum.url.replace(/\/$/, '').toLowerCase();
const memory = (globalThis as unknown as { __discussWatchForumCache: { memoryCache: Map<string, CachedForum> } }).__discussWatchForumCache.memoryCache;
const feed = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
const item = (id: number, title = 'Fresh grant announcement', date = '2026-10-14T14:08:15Z', origin = key) => `<item><title>${title}</title><link>${origin}/t/topic-${id}/${id}</link><description><![CDATA[<p>Applications open with a new source-grounded first post.</p>]]></description>${date ? `<pubDate>${date}</pubDate>` : ''}</item>`;
const oldTopic: DiscussionTopic = {
  id: 17, refId: 'celestia-17', protocol: 'Celestia', title: 'Earlier title', slug: 'topic-17',
  tags: ['research'], categoryId: 4, postsCount: 12, views: 512, replyCount: 11, likeCount: 9,
  pinned: true, visible: true, closed: true, archived: false,
  createdAt: '2026-10-01T00:00:00.000Z', bumpedAt: '2026-10-12T00:00:00.000Z', forumUrl: key,
};

test('failed refresh keeps stale data and age visible; official RSS recovery serves fresh content and clears error', async () => {
  const fetchedAt = Date.now() - 86_400_000;
  const previous = { url: forum.url, topics: [oldTopic], fetchedAt };
  let calls = 0;
  const fetcher = async (url: string) => {
    assert.equal(url, `${key}/latest.rss`);
    return ++calls === 1 ? new Response('Blocked', { status: 403 }) : new Response(feed(item(23)));
  };
  const failed = await fetchDiscourseRssTopics(forum, previous.topics, fetcher);
  const stale = forumCacheAfterFetch(forum.url, failed, previous);
  memory.set(key, stale);
  assert.equal(stale.fetchedAt, fetchedAt);
  assert.equal(stale.error, 'RSS http_403');
  assert.equal(await getCachedForum(forum.url), stale);
  const health = getForumHealthFromCache().find(h => h.name === forum.name)!;
  assert.equal(health.status, 'error');
  assert.equal(health.topicCount, 1);
  assert.equal(health.lastFetched, fetchedAt);
  const response = await GET(new NextRequest(`https://app.example/api/discourse?forumUrl=${encodeURIComponent(forum.url)}`));
  const payload = await response.json();
  assert.equal(payload.stale, true);
  assert.equal(payload.cachedAt, fetchedAt);
  assert.equal(payload.refreshError, 'RSS http_403');

  const fresh = await fetchDiscourseRssTopics(forum, previous.topics, fetcher);
  const now = Date.now();
  const recovered = forumCacheAfterFetch(forum.url, fresh, stale, now);
  memory.set(key, recovered);
  assert.equal(recovered.error, undefined);
  assert.equal(recovered.fetchedAt, now);
  assert.deepEqual(recovered.topics.map(t => t.id), [23]);
  assert.equal(recovered.topics[0].firstPostText, 'Applications open with a new source-grounded first post.');
  assert.equal(recovered.topics[0].createdAt, '2026-10-14T14:08:15.000Z');
  assert.equal(getForumHealthFromCache().find(h => h.name === forum.name)!.status, 'ok');
  assert.equal(calls, 2, 'a challenge is not retried');
  memory.delete(key);
});

test('RSS preserves prior engagement and moderation without claiming a new last-reply date', async () => {
  const result = await fetchDiscourseRssTopics(forum, [oldTopic], async () => new Response(feed(item(17, 'Revised first-post title'))));
  assert.equal(result.error, undefined);
  const topic = result.topics[0];
  assert.equal(topic.title, 'Revised first-post title');
  for (const field of ['postsCount', 'views', 'replyCount', 'likeCount', 'categoryId', 'closed', 'pinned', 'createdAt', 'bumpedAt'] as const) {
    assert.equal(topic[field], oldTopic[field], field);
  }
  assert.deepEqual(topic.tags, oldTopic.tags);
  assert.equal(topic.metadataSource, 'discourse-rss');
});

test('untrusted topic identity, missing publication dates and invalid RSS never create fresh cache state', async () => {
  for (const xml of [feed(item(23, 'External', '2026-10-14', 'https://other.example')), feed(item(23, 'Missing date', '')), '<html><title>Just a moment</title></html>']) {
    const result = await fetchDiscourseRssTopics(forum, [], async () => new Response(xml));
    assert.ok(result.error);
    assert.deepEqual(result.topics, []);
    const state = forumCacheAfterFetch(forum.url, result);
    assert.equal(state.fetchedAt, 0, 'unknown source-fetch age stays unknown');
    memory.set(key, state);
    assert.equal(await getCachedForum(forum.url), state, 'no-content errors survive the cache TTL');
  }
  memory.delete(key);
});
