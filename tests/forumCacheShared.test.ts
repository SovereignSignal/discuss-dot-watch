import test from 'node:test';
import assert from 'node:assert/strict';
import type { CachedForum } from '@/lib/forumCache';

/**
 * Next.js (Turbopack) bundles src/lib/forumCache into the instrumentation
 * entry AND into the API-route chunk group as two separate module copies.
 * The refresh loop runs in the instrumentation copy; route handlers read
 * from theirs. If each copy owned its own Map, the feed would freeze at the
 * first Redis hydration after every deploy. The cache state must therefore
 * live at one process-wide key so every copy reads and writes the same data.
 */
const SHARED_KEY = '__discussWatchForumCache';

test('every module copy of forumCache serves the same in-memory cache', async () => {
  const a = await import('../src/lib/forumCache.ts');
  const b = await import('../src/lib/forumCache.ts?instance=b'); // distinct ESM instance
  assert.notEqual(a, b, 'test needs two module instances');

  const shared = (globalThis as Record<string, unknown>)[SHARED_KEY] as
    | { memoryCache: Map<string, CachedForum> }
    | undefined;
  assert.ok(shared, `forumCache state must be process-wide at globalThis.${SHARED_KEY}`);

  const forum: CachedForum = {
    url: 'https://forum.example.org',
    name: 'Example',
    categoryId: 'crypto',
    topics: [],
    lastUpdated: Date.now(),
  } as unknown as CachedForum;
  shared.memoryCache.set(forum.url, forum);

  assert.ok(a.getAllCachedForums().some(f => f.url === forum.url), 'copy A must see the entry');
  assert.ok(b.getAllCachedForums().some(f => f.url === forum.url), 'copy B must see the entry');
  shared.memoryCache.delete(forum.url);
});
