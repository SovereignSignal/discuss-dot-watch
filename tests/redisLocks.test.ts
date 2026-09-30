import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import Redis from 'ioredis';

/**
 * Lock ownership without a live Redis: SET NX and the compare-and-delete
 * script are replaced by an in-memory store with the same semantics, so the
 * test exercises our token handling rather than the network.
 */
const store = new Map<string, string>();
const proto = Redis.prototype as unknown as Record<string, unknown>;
proto.set = async (key: string, value: string) => {
  if (store.has(key)) return null;
  store.set(key, value);
  return 'OK';
};
const extends_: Array<{ key: string; token: string; ttl: string }> = [];
proto.eval = async (script: string, _n: number, key: string, token: string, ttl?: string) => {
  if (store.get(key) !== token) return 0;
  if (script.includes("'expire'")) {
    extends_.push({ key, token, ttl: ttl! });
    return 1;
  }
  store.delete(key);
  return 1;
};

process.env.REDIS_URL = 'redis://127.0.0.1:1';
const redis = () => import('@/lib/redis');

test.after(async () => (await redis()).getRedis()?.disconnect());

test('a second holder is refused while the lock is held', async () => {
  const { acquireRefreshLock, releaseRefreshLock } = await redis();
  store.clear();
  const first = await acquireRefreshLock();
  assert.ok(first);
  assert.equal(await acquireRefreshLock(), null);
  await releaseRefreshLock(first!);
  assert.ok(await acquireRefreshLock());
});

test('an expired holder cannot release the lock a newer holder took', async () => {
  // Deploy overlap: the old instance's lock expired mid-refresh, the new
  // instance took it, then the old instance finished and released.
  const { acquireRefreshLock, releaseRefreshLock } = await redis();
  store.clear();
  const stale = await acquireRefreshLock();
  store.clear(); // TTL expiry
  const fresh = await acquireRefreshLock();
  assert.ok(stale && fresh && stale !== fresh);
  await releaseRefreshLock(stale!);
  assert.equal(await acquireRefreshLock(), null, 'the newer holder still owns the lock');
});

test('the holder renews its lock every third of the TTL until stopped', async () => {
  // A killed instance stops renewing, so its lock lapses within one TTL
  // instead of blocking the next instance for a whole refresh.
  const { acquireRefreshLock, holdRefreshLock } = await redis();
  store.clear();
  extends_.length = 0;
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const token = (await acquireRefreshLock(300))!;
    const stop = holdRefreshLock(token, 300);
    mock.timers.tick(100_000);
    mock.timers.tick(100_000);
    await new Promise(setImmediate);
    assert.equal(extends_.length, 2);
    assert.deepEqual(extends_[0], { key: extends_[0].key, token, ttl: '300' });
    stop();
    mock.timers.tick(300_000);
    await new Promise(setImmediate);
    assert.equal(extends_.length, 2, 'no renewals after stop');
  } finally {
    mock.timers.reset();
  }
});
