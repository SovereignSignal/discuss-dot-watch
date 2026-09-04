import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryFeedUrl, selectCategoryBatch } from '@/lib/grantsScan';

// ── Feed URL shape ───────────────────────────────────────────────────
// Verified live against discuss.ens.domains on 2026-09-04:
//   /c/public-goods/37.rss                        -> 25 items (top level)
//   /c/resource-requests/55.rss                   ->  0 items (WRONG, id 55 is a subcategory)
//   /c/ens-ecosystem/resource-requests/55.rss     ->  9 items (correct)
//   /c/55.rss                                     ->  0 items (bare id never works)

test('a top-level category feed is /c/{slug}/{id}.rss', () => {
  assert.equal(
    categoryFeedUrl('https://discuss.ens.domains', { id: 37, slug: 'public-goods' }),
    'https://discuss.ens.domains/c/public-goods/37.rss',
  );
});

test('a subcategory feed must carry its parent slug or Discourse returns nothing', () => {
  assert.equal(
    categoryFeedUrl('https://discuss.ens.domains', { id: 55, slug: 'resource-requests', parentSlug: 'ens-ecosystem' }),
    'https://discuss.ens.domains/c/ens-ecosystem/resource-requests/55.rss',
  );
});

test('a trailing slash on the forum url does not double up', () => {
  assert.equal(
    categoryFeedUrl('https://forum.celo.org/', { id: 27, slug: 'grants' }),
    'https://forum.celo.org/c/grants/27.rss',
  );
});

// ── Rotation ─────────────────────────────────────────────────────────
// The old loop broke out at the budget and always restarted from index 0,
// so any category past the 25th was never fetched — the log claimed they
// were "deferred to next hourly pass", but no pass ever reached them.

test('a batch that fits the budget takes everything', () => {
  const items = [1, 2, 3];
  const { batch, nextCursor } = selectCategoryBatch(items, 0, 25);
  assert.deepEqual(batch, [1, 2, 3]);
  assert.equal(nextCursor, 0, 'a full sweep leaves the cursor at the start');
});

test('an oversized list is capped at the budget', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  const { batch, nextCursor } = selectCategoryBatch(items, 0, 25);
  assert.deepEqual(batch, items.slice(0, 25));
  assert.equal(nextCursor, 25);
});

test('the next pass resumes where the last one stopped and wraps', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  const { batch, nextCursor } = selectCategoryBatch(items, 25, 25);
  assert.deepEqual(batch, [25, 26, 27, 28, 29, ...Array.from({ length: 20 }, (_, i) => i)]);
  assert.equal(nextCursor, 20);
});

test('every category is reached within ceil(n/budget) passes', () => {
  const items = Array.from({ length: 62 }, (_, i) => i);
  const seen = new Set<number>();
  let cursor = 0;
  for (let pass = 0; pass < 3; pass++) {
    const r = selectCategoryBatch(items, cursor, 25);
    r.batch.forEach(i => seen.add(i));
    cursor = r.nextCursor;
  }
  assert.equal(seen.size, 62, 'no category may be permanently starved');
});

test('an empty list is safe', () => {
  const { batch, nextCursor } = selectCategoryBatch([], 7, 25);
  assert.deepEqual(batch, []);
  assert.equal(nextCursor, 0);
});
