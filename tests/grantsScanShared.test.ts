import test from 'node:test';
import assert from 'node:assert/strict';
import type { DiscussionTopic } from '@/types';

/**
 * Turbopack loads lib/grantsScan twice (instrumentation entry and API-route
 * chunks). Its queue, category cursor and scanning flag must be one
 * process-wide state, or the second copy restarts the category rotation and
 * scans past the first copy's isScanning guard. A copy that evaluates later
 * must ADOPT the state already on globalThis, not replace it.
 *
 * No static import of grantsScan: the global is seeded first, playing the
 * earlier-loading copy. Node runs each test file in its own process.
 */
const KEY = '__discussWatchGrantsScan';
const seeded = {
  pendingExternal: new Map(),
  lastCategoryFetch: 0,
  categoryCursor: 17,
  isScanning: false,
};
const globalWithScan = globalThis as typeof globalThis & { [KEY]?: typeof seeded };
globalWithScan[KEY] = seeded;

test('a later module copy adopts the existing scan state', async () => {
  const { queueGrantsCandidate } = await import('@/lib/grantsScan');
  queueGrantsCandidate(
    { refId: 'ea-forum:abc', title: 'Fast grants', protocol: 'ea-forum', forumUrl: 'https://forum.effectivealtruism.org', slug: 'x', id: 1 } as DiscussionTopic,
    'ai', 'body', 'external',
  );
  const state = globalWithScan[KEY];
  assert.equal(state, seeded, 'the seeded object was replaced');
  assert.equal(state.categoryCursor, 17);
  assert.ok(seeded.pendingExternal.has('ea-forum:abc'), 'the queue write went to a private map');
});
