import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeGrantsCandidateShadow, isShadowJudgeConfigured } from '@/lib/typesafeShadow';

const ENV = ['TYPESAFE_API_KEY', 'TYPESAFE_SHADOW', 'TYPESAFE_MODEL'] as const;

const CANDIDATE = {
  title: 'Round 41 - GMC Call for Retrospective Applications - Deadline is October 7',
  protocol: 'Rocket Pool',
  vertical: 'crypto' as const,
  signal: 'grants:keyword',
  createdAt: '2026-09-15T00:00:00.000Z',
};

function okBody(over: Record<string, unknown> = {}) {
  return {
    model: 'jev-1.13.0',
    answers: {
      classification: { type: 'choice', choice: 'GRANT', confidence: 0.94, probabilities: { GRANT: 0.94 } },
      open_window: { type: 'noul', noul: 0.91 },
      is_record: { type: 'noul', noul: 0.05 },
    },
    usage: { input_tokens: 296, output_tokens: 20 },
    ...over,
  };
}

/**
 * Run the judge against a stubbed transport. `responder` receives the call
 * count (1-based) so a test can fail the first attempt and pass the second.
 */
async function withFetch<T>(
  env: Partial<Record<(typeof ENV)[number], string | undefined>>,
  responder: (call: number, init: RequestInit | undefined) => Response | Promise<Response> | Promise<never>,
  run: () => Promise<T>,
): Promise<{ result: T; calls: number; bodies: string[] }> {
  const prev: Record<string, string | undefined> = {};
  for (const k of ENV) { prev[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  const realFetch = globalThis.fetch;
  let calls = 0;
  const bodies: string[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    calls++;
    if (typeof init?.body === 'string') bodies.push(init.body);
    return responder(calls, init);
  }) as unknown as typeof fetch;
  try {
    return { result: await run(), calls, bodies };
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('ships dark: no API key means no call and no judgement', async () => {
  const { result, calls } = await withFetch({}, () => json(okBody()), () =>
    judgeGrantsCandidateShadow(CANDIDATE));
  assert.equal(result, null);
  assert.equal(calls, 0, 'must not reach the network without a key');
});

test('TYPESAFE_SHADOW=0 disables the lane even when the key is present', async () => {
  const { result, calls } = await withFetch(
    { TYPESAFE_API_KEY: 'k', TYPESAFE_SHADOW: '0' },
    () => json(okBody()),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(result, null);
  assert.equal(calls, 0);
  assert.equal(isShadowJudgeConfigured(), false);
});

test('parses a judgement and pins the model by default', async () => {
  const { result, bodies } = await withFetch(
    { TYPESAFE_API_KEY: 'k' },
    () => json(okBody()),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(result?.classification, 'GRANT');
  assert.equal(result?.confidence, 0.94);
  assert.equal(result?.openWindow, 0.91);
  assert.equal(result?.isRecord, 0.05);
  assert.equal(result?.model, 'jev-1.13.0');
  assert.equal(result?.inputTokens, 296);
  const sent = JSON.parse(bodies[0]);
  assert.equal(sent.model, 'jev-1.13.0', 'an unannounced model change must not move the gate');
  assert.equal(sent.state.title, CANDIDATE.title);
  assert.match(sent.state.posted, /^2026-09-15 \(\d+ days ago\)$/);
});

test('TYPESAFE_MODEL overrides the pin', async () => {
  const { bodies } = await withFetch(
    { TYPESAFE_API_KEY: 'k', TYPESAFE_MODEL: 'jev-preview' },
    () => json(okBody()),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(JSON.parse(bodies[0]).model, 'jev-preview');
});

test('a server error yields null rather than failing the row', async () => {
  const { result } = await withFetch(
    { TYPESAFE_API_KEY: 'k' },
    () => json({ error: 'boom' }, 500),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(result, null);
});

test('a thrown transport error yields null rather than propagating', async () => {
  const { result } = await withFetch(
    { TYPESAFE_API_KEY: 'k' },
    () => Promise.reject(new Error('socket hang up')),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(result, null);
});

test('retries a 429 with backoff and keeps the second answer', async () => {
  const { result, calls } = await withFetch(
    { TYPESAFE_API_KEY: 'k' },
    (call) => (call === 1 ? json({ error: 'rate limited' }, 429) : json(okBody())),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(calls, 2);
  assert.equal(result?.classification, 'GRANT');
});

test('gives up after the retry budget instead of hammering the API', async () => {
  const { result, calls } = await withFetch(
    { TYPESAFE_API_KEY: 'k' },
    () => json({ error: 'overloaded' }, 529),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(result, null);
  assert.equal(calls, 3, 'one attempt plus two retries');
});

test('an out-of-vocabulary label is dropped, not stored', async () => {
  const { result } = await withFetch(
    { TYPESAFE_API_KEY: 'k' },
    () => json(okBody({ answers: { classification: { choice: 'FUNDING', confidence: 0.99 } } })),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(result, null, 'the shadow column must only ever hold the four known labels');
});

test('a nonsense probability is dropped while the label survives', async () => {
  const { result } = await withFetch(
    { TYPESAFE_API_KEY: 'k' },
    () => json(okBody({
      answers: {
        classification: { choice: 'NEWS', confidence: 0.6 },
        open_window: { noul: 42 },
        is_record: { noul: null },
      },
    })),
    () => judgeGrantsCandidateShadow(CANDIDATE),
  );
  assert.equal(result?.classification, 'NEWS');
  assert.equal(result?.openWindow, null);
  assert.equal(result?.isRecord, null);
});

test('a candidate with no posting date still builds valid state', async () => {
  const { bodies, result } = await withFetch(
    { TYPESAFE_API_KEY: 'k' },
    () => json(okBody()),
    () => judgeGrantsCandidateShadow({ ...CANDIDATE, createdAt: null }),
  );
  assert.equal(JSON.parse(bodies[0]).state.posted, 'unknown');
  assert.equal(result?.classification, 'GRANT');
});
