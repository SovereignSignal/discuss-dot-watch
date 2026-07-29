import { getRedis } from '@/lib/redis';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 50;
const MIN_LOCAL_GAP_MS = 1_100;

const queues = new Map<string, Promise<void>>();
const lastRequestAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSharedWindow(hostname: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  const window = Math.floor(Date.now() / WINDOW_MS);
  const key = `rate:discourse:${hostname}:${window}`;

  try {
    const count = await client.incr(key);
    if (count === 1) await client.pexpire(key, WINDOW_MS + 5_000);
    if (count > MAX_REQUESTS_PER_WINDOW) {
      await sleep(WINDOW_MS - (Date.now() % WINDOW_MS) + 100);
      await waitForSharedWindow(hostname);
    }
  } catch (error) {
    console.warn('[Discourse] Shared Redis rate limit unavailable:', error instanceof Error ? error.message : error);
  }
}

/** Serialize requests per host locally and enforce the shared budget in Redis. */
export function waitForDiscourseRateLimit(baseUrl: string): Promise<void> {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  const previous = queues.get(hostname) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const localWait = Math.max(0, MIN_LOCAL_GAP_MS - (Date.now() - (lastRequestAt.get(hostname) ?? 0)));
    if (localWait > 0) await sleep(localWait);
    await waitForSharedWindow(hostname);
    lastRequestAt.set(hostname, Date.now());
  });

  queues.set(hostname, current);
  void current.finally(() => {
    if (queues.get(hostname) === current) queues.delete(hostname);
  });
  return current;
}
