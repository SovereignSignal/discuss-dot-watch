/** Optional standalone writer. Disabled until the operator explicitly enables external calls. */
import { prepare, check } from './core.mjs';
export function modelConfigured(env = process.env) {
  return env.WRITING_LAB_ALLOW_MODEL_CALLS === 'true' && !!env.ANTHROPIC_API_KEY && !!env.WRITING_LAB_MODEL;
}
export function createWriter({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  let calls = 0;
  return async (request, corpus) => {
    if (!modelConfigured(env)) throw new Error('Writer disabled: requires explicit model-call opt-in, model id and Anthropic API key');
    const packet = prepare(request, corpus, { external: true });
    if (calls >= 10) throw new Error('Writer process limit reached (10 calls); no automatic retry');
    calls++;
    const started = Date.now();
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.WRITING_LAB_MODEL, max_tokens: 2048,
        system: packet.instructions, messages: [{ role: 'user', content: JSON.stringify({ request: packet.request,
          examples: packet.examples, warnings: packet.warnings }) }] }),
    });
    // Never include provider error bodies or credentials in output/logs.
    if (!response.ok) throw new Error(`Writer provider HTTP ${response.status}`);
    const chunks = []; let size = 0;
    if (!response.body) throw new Error('Missing provider response');
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 256 * 1024) throw new Error('Provider response exceeds limit');
      chunks.push(Buffer.from(chunk));
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (result.stop_reason !== 'end_turn') throw new Error('Writer did not finish normally; output withheld');
    if (!Array.isArray(result.content)) throw new Error('Malformed provider response');
    const text = result.content.filter(b => b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n').trim();
    if (!text || text.length > 20000) throw new Error('Empty or oversized writer output');
    return { text, review: check({ request, text }, corpus, { external: true }),
      model: typeof result.model === 'string' ? result.model : env.WRITING_LAB_MODEL,
      usage: { inputTokens: Number.isSafeInteger(result.usage?.input_tokens) ? result.usage.input_tokens : null,
        outputTokens: Number.isSafeInteger(result.usage?.output_tokens) ? result.usage.output_tokens : null },
      durationMs: Date.now() - started, requestHash: packet.requestHash, exampleIds: packet.examples.map(e => e.id),
      warnings: packet.warnings, sent: false, published: false };
  };
}
