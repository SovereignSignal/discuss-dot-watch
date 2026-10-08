import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundRefreshTiers, TIER3_INTERVAL_MS } from '@/lib/forumCache';

test('tier 3 joins the first periodic pass after boot, then once a day', () => {
  const now = Date.parse('2026-10-08T15:30:00Z');
  assert.deepEqual(backgroundRefreshTiers(undefined, now), [1, 2, 3]);
  assert.deepEqual(backgroundRefreshTiers(null, now), [1, 2, 3]);
  assert.deepEqual(backgroundRefreshTiers(now - 15 * 60_000, now), [1, 2]);
  assert.deepEqual(backgroundRefreshTiers(now - TIER3_INTERVAL_MS, now), [1, 2, 3]);
});
