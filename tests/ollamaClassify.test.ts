import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStructured } from '@/lib/llm';

const ENV_KEYS = ['LLM_PROVIDER', 'OLLAMA_API_KEY', 'LLM_MODEL', 'LLM_MODEL_CLASSIFY', 'OLLAMA_BASE_URL'] as const;

async function withOllamaEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) prev[k] = process.env[k];
  process.env.LLM_PROVIDER = 'ollama';
  process.env.OLLAMA_API_KEY = 'test-key';
  process.env.LLM_MODEL = 'glm-5.2';
  process.env.LLM_MODEL_CLASSIFY = 'gpt-oss:20b-cloud';
  delete process.env.OLLAMA_BASE_URL;
  try {
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

/** Capture the JSON body the provider layer sends to /api/chat. */
async function captureOllamaRequest(reply: string): Promise<{ body: Record<string, unknown>; result: Awaited<ReturnType<typeof generateStructured>> }> {
  const realFetch = globalThis.fetch;
  let body: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ message: { content: reply } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const result = await withOllamaEnv(() => generateStructured({
      prompt: 'classify this',
      maxTokens: 500,
      schema: { type: 'object', required: ['classification', 'kind', 'confidence'] },
      toolName: 'record_grants_classification',
      toolDescription: 'test',
      context: 'test',
    }));
    assert.ok(body, 'no request was sent');
    return { body: body as Record<string, unknown>, result };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('classify asks the model for low reasoning effort, not think=false (gpt-oss ignores false and burns the budget)', async () => {
  const { body } = await captureOllamaRequest('{"classification":"GRANT","kind":"application","confidence":90}');
  assert.equal(body.model, 'gpt-oss:20b-cloud');
  assert.equal(body.think, 'low');
});

test('classify leaves room for the JSON after reasoning', async () => {
  const { body } = await captureOllamaRequest('{"classification":"GRANT","kind":"application","confidence":90}');
  const numPredict = (body.options as { num_predict: number }).num_predict;
  assert.ok(numPredict >= 1500, `num_predict=${numPredict}: gpt-oss spends ~500 tokens reasoning before the answer`);
});

test('classify still returns the parsed object stamped with the classify model', async () => {
  const { result } = await captureOllamaRequest('{"classification":"GRANT","kind":"application","confidence":90}');
  assert.deepEqual(result, {
    output: { classification: 'GRANT', kind: 'application', confidence: 90 },
    model: 'gpt-oss:20b-cloud',
  });
});
