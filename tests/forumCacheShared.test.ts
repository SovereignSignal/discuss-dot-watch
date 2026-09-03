import test from 'node:test';
import assert from 'node:assert/strict';
import type { CachedForum } from '@/lib/forumCache';

/**
 * Next.js (Turbopack) bundles src/lib/forumCache into the instrumentation
 * entry AND into the API-route chunk group as two separate module copies.
 * The refresh loop runs in the instrumentation copy; route handlers read
 * from theirs. If each copy owned its own Map, the feed would freeze at the
 * first Redis hydration after every deploy.
 *
 * The contract that makes them agree: the mutable state lives at one
 * process-wide key, and a copy that evaluates LATER adopts the state that is
 * already there instead of replacing it (the `??=` in forumCache.ts).
 *
 * This file must not import forumCache statically — the first test seeds the
 * global BEFORE the module's first evaluation to play the part of the
 * earlier-loading copy. Node runs each test file in its own process, so the
 * import order here is ours to control.
 */
const SHARED_KEY = '__discussWatchForumCache';

type ForumCacheModule = typeof import('@/lib/forumCache');

/** tsc rejects a '.ts' extension in a literal specifier (TS5097), so route
 *  the import through a runtime string and type the result from the alias. */
function importForumCache(): Promise<ForumCacheModule> {
  return import('@/lib/forumCache' as string) as Promise<ForumCacheModule>;
}

interface SeededState {
  memoryCache: Map<string, CachedForum>;
  forumIdCache: Map<string, number>;
  forumHealthState: Map<string, unknown>;
  cacheVersion: number;
  hydrationPromise: Promise<void> | null;
  isRefreshing: boolean;
  lastRefreshStart: number;
  refreshInterval: NodeJS.Timeout | null;
}

const globalWithCache = globalThis as typeof globalThis & { [SHARED_KEY]?: SeededState };

const seeded: SeededState = {
  memoryCache: new Map(),
  forumIdCache: new Map(),
  forumHealthState: new Map(),
  cacheVersion: 7,
  hydrationPromise: null,
  isRefreshing: false,
  lastRefreshStart: 0,
  refreshInterval: null,
};

const forum = {
  url: 'https://forum.example.org',
  topics: [],
  fetchedAt: Date.now(),
} as unknown as CachedForum;

test('a later-loading copy adopts the cache the first copy already built', async () => {
  // Stand in for the copy that loaded first and has been refreshing.
  seeded.memoryCache.set(forum.url, forum);
  globalWithCache[SHARED_KEY] = seeded;

  const mod = await importForumCache(); // first evaluation in this process

  assert.equal(globalWithCache[SHARED_KEY], seeded, 'module must adopt the existing state object, not replace it');
  assert.ok(
    mod.getAllCachedForums().some((f: CachedForum) => f.url === forum.url),
    'the newly-loaded copy must serve the entry the first copy cached',
  );
  assert.equal(mod.getForumCacheVersion(), 7, 'version must come from the shared state');
});

test('a refresh written into the shared state is visible through the public reader', async () => {
  const mod = await importForumCache();
  const added = { ...forum, url: 'https://forum.two.example.org' } as CachedForum;

  globalWithCache[SHARED_KEY]!.memoryCache.set(added.url, added);

  assert.ok(
    mod.getAllCachedForums().some((f: CachedForum) => f.url === added.url),
    'the module reads the shared Map, not a private copy',
  );
  globalWithCache[SHARED_KEY]!.memoryCache.delete(added.url);
});
