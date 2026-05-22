#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://www.discuss.watch';

const baseUrl = (process.argv[2] || process.env.DISCUSS_WATCH_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

async function fetchJson(path) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'discuss-watch-smoke-check/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchOk(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'User-Agent': 'discuss-watch-smoke-check/1.0' },
  });

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [
  {
    name: 'homepage',
    run: async () => {
      await fetchOk('/');
      return '200 OK';
    },
  },
  {
    name: 'health',
    run: async () => {
      const data = await fetchJson('/api/health');
      assert(data.status === 'ok', 'health status is not ok');
      assert(data.checks?.database === 'ok', 'database check is not ok');
      assert(data.checks?.redis === 'ok', 'redis check is not ok');
      return 'database ok, redis ok';
    },
  },
  {
    name: 'all discussions',
    run: async () => {
      const data = await fetchJson('/api/discussions?limit=1&dateRange=all');
      assert(Array.isArray(data.topics), 'topics is not an array');
      assert(data.topics.length > 0, 'no discussions returned');
      assert(data.meta?.cachedForumCount > 0, 'cached forum count is empty');
      return `${data.meta.total} discussions, ${data.meta.cachedForumCount} cached forums`;
    },
  },
  {
    name: 'briefs',
    run: async () => {
      const data = await fetchJson('/api/briefs?category=all');
      assert(Array.isArray(data.hot), 'hot briefs is not an array');
      assert(Array.isArray(data.fresh), 'fresh briefs is not an array');
      assert(data.hot.length + data.fresh.length > 0, 'no briefs returned');
      return `${data.hot.length} hot, ${data.fresh.length} fresh`;
    },
  },
  {
    name: 'categories',
    run: async () => {
      const data = await fetchJson('/api/v1/categories');
      assert(Array.isArray(data.data), 'categories data is not an array');
      assert(data.meta?.totalForums > 0, 'total forum count is empty');
      const verticals = data.meta?.verticals || {};
      return `crypto ${verticals.crypto}, ai ${verticals.ai}, oss ${verticals.oss}`;
    },
  },
];

console.log(`Smoke checking ${baseUrl}`);

let failures = 0;
for (const check of checks) {
  try {
    const detail = await check.run();
    console.log(`OK ${check.name}: ${detail}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
