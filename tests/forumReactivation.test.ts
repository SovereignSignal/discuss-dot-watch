import test from 'node:test';
import assert from 'node:assert/strict';
import { forumNeedsReactivation } from '../src/lib/forumCache';

// The streak counter is in-memory and resets on deploy; a forum marked inactive before a restart
// must be reactivated by its first successful fetch in the new process (Uniswap, 2026-10-15).
test('a forum row is reactivated on recovery from a defunct streak and on the first success after a restart', () => {
  assert.equal(forumNeedsReactivation({ consecutiveFailures: 10, lastSuccess: 0 }), true);
  assert.equal(forumNeedsReactivation({ consecutiveFailures: 0, lastSuccess: null }), true);
  assert.equal(forumNeedsReactivation({ consecutiveFailures: 3, lastSuccess: 1 }), false);
  assert.equal(forumNeedsReactivation({ consecutiveFailures: 0, lastSuccess: 1 }), false);
});
