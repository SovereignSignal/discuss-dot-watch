import test from 'node:test';
import assert from 'node:assert/strict';
import { BATCH, checkedUrl, feedPath, categoryRows, topicWindow, parseFeed } from '../scripts/audit-sources.mjs';

test('batch has exactly twenty distinct names', () => {
  assert.equal(BATCH.length, 20);
  assert.equal(new Set(BATCH).size, 20);
});
test('requests reject cross-origin redirects, credentials and non-HTTPS URLs', () => {
  assert.equal(checkedUrl('/latest.json', 'https://forum.example').href, 'https://forum.example/latest.json');
  for (const u of ['http://forum.example', 'https://internal.example/x', 'https://user:pass@forum.example/x', '//other.example/x']) {
    assert.throws(() => checkedUrl(u, 'https://forum.example'));
  }
});
test('RSS paths retain parent categories and encode untrusted slugs', () => {
  assert.equal(feedPath({ type: 'category', id: 4, slug: 'jobs', parentSlug: 'community' }), '/c/community/jobs/4.rss');
  assert.equal(feedPath({ type: 'tag', slug: 'rfp', tagId: 26 }), '/tag/rfp/26.rss');
  assert.equal(feedPath({ type: 'tag', slug: '../x' }), '/tag/..%2Fx.rss');
});
test('category discovery resolves flat and nested parent relationships', () => {
  const rows = categoryRows({ category_list: { categories: [
    { id: 1, name: 'Parent', slug: 'parent', subcategory_ids: [2, 3], subcategory_list: [{ id: 2, name: 'Child', slug: 'child' }] },
    { id: 3, name: 'Flat child', slug: 'flat' },
  ] } });
  assert.equal(rows.find(r => r.id === 2).parentId, 1);
  assert.equal(rows.find(r => r.id === 3).parentId, 1);
});
test('feed diagnostics distinguish valid empty RSS from HTML or malformed content', () => {
  assert.equal(parseFeed('<html><body>Unavailable</body></html>').itemCount, null);
  assert.equal(parseFeed('<rss><channel></channel></rss>').itemCount, 0);
  const r = parseFeed('<rss><channel><item><title><![CDATA[An RFP]]></title><link>https://forum.example/t/a/1</link><pubDate>date</pubDate></item></channel></rss>');
  assert.equal(r.itemCount, 1);
  assert.equal(r.sample[0].title, 'An RFP');
});
test('history sample ignores pins and future timestamps when counting the window', () => {
  const now = Date.parse('2026-10-03T00:00:00Z');
  const result = topicWindow([
    { id: 1, pinned: true, created_at: '2019-01-01' },
    { id: 2, created_at: '2026-09-30', bumped_at: '2026-10-01' },
    { id: 3, created_at: '2027-01-01' },
  ], now);
  assert.equal(result.within180Days, 1);
  assert.equal(result.oldestCreated, '2026-09-30T00:00:00.000Z');
});
