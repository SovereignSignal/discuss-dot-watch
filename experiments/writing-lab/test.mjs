import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { parseRequest, validateCorpus, recordHash, retrieve, prepare, check, importDiscourse, feedbackRecord, blindEvaluation } from './core.mjs';
import { readJson, readStdin, loadCorpus, saveFeedback, writeNewJson, MAX_BYTES } from './io.mjs';
import { createSession, serve } from './mcp.mjs';
import { createWriter } from './provider.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const fixtures = await loadCorpus();
const req = { brief: 'Explain the decision.', audience: 'A colleague', intent: 'explain', genre: 'memo' };
const clone = x => structuredClone(x);
const approved = (id = 'real-1') => {
  const r = clone(fixtures.find(x => x.intent === 'explain'));
  r.id = id; r.source = { ...r.source, kind: 'forum', url: `https://example.org/t/${id}`, thread: id, author: id };
  r.review = { status: 'approved', reviewer: 'Test reviewer', reviewedHash: r.source.contentHash };
  r.rights.basis = 'Test-only permission fixture; not a real permission claim.';
  return r;
};
const codes = (request, text, corpus = []) => check({ request, text }, corpus).issues.map(x => x.code);
const topic = () => ({ id: 10, title: 'Example topic', post_stream: { stream: [101, 102, 103], posts: [
  { id: 101, post_number: 1, raw: 'We should review the current design.', username: 'root' },
  { id: 102, post_number: 2, raw: 'Which problem would this change solve?', username: 'one' },
  { id: 103, post_number: 3, reply_to_post_number: 2, raw: 'It would let us recover when the source is unavailable.', username: 'two' },
] } });
const imported = x => importDiscourse(x, { origin: 'https://example.org', retrievedAt: '2026-10-14T12:00:00Z' });
const feedback = () => ({ request: req, draft: 'Original text.', final: 'Edited text.', changeKinds: ['style'], consentToStore: true, reviewer: 'Test reviewer' });
const env = { WRITING_LAB_ALLOW_MODEL_CALLS: 'true', WRITING_LAB_MODEL: 'test-model', ANTHROPIC_API_KEY: 'test-only-key' };
const response = (overrides = {}) => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Here is the explanation.' }], model: 'test-model', usage: { input_tokens: 12, output_tokens: 5 }, ...overrides }));
const msg = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const init = () => msg(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' };
async function ready(options = {}) {
  const session = createSession({ getCorpus: async () => fixtures, allowWrite: false, allowFeedback: false, ...options });
  await session(init()); await session(initialized); return session;
}
async function temporary(fn) {
  const dir = await fs.mkdtemp(join(tmpdir(), 'writing-lab-'));
  try { return await fn(dir); } finally { await fs.rm(dir, { recursive: true, force: true }); }
}
const cleanEnv = { ...process.env, WRITING_LAB_CORPUS: '', WRITING_LAB_DATA_DIR: '', WRITING_LAB_ALLOW_MODEL_CALLS: '', ANTHROPIC_API_KEY: '', WRITING_LAB_MODEL: '' };

test('request defaults and all fixture hashes validate', () => { assert.equal(parseRequest(req).maxWords, 250); assert.equal(validateCorpus(fixtures).length, 14); });
test('reject unknown fields, invalid intent, oversized input and NUL', () => {
  for (const r of [{ ...req, secret: 1 }, { ...req, intent: 'spam' }, { ...req, brief: 'a'.repeat(8001) }, { ...req, brief: '\0' }]) assert.throws(() => parseRequest(r));
});
test('protected spans must exist in factual input', () => { assert.throws(() => parseRequest({ ...req, protectedSpans: ['$40'] })); });
test('default contains no eligible human examples', () => { const p = prepare(req, fixtures); assert.equal(p.examples.length, 0); assert.match(p.warnings[0], /No eligible/); });
test('illustrative examples require explicit opt-in and carry warning', () => { const p = prepare({ ...req, includeIllustrative: true }, fixtures); assert.equal(p.examples.length, 2); assert.match(p.warnings[0], /AI-authored/); });
test('approved examples select by intent and report provenance', () => { const p = prepare(req, [approved()]); assert.equal(p.examples[0].provenance.kind, 'forum'); assert.match(p.examples[0].selectionReason, /intent=explain/); });
test('unreviewed, revoked, eval, incomplete and rights-blocked records fail closed', () => {
  for (const alter of [r => r.review.status = 'candidate', r => r.revoked = true, r => r.split = 'eval', r => r.source.contextComplete = false, r => r.rights.retrieval = false, r => r.rights.basis = '', r => r.rights.externalProcessing = false]) {
    const r = approved(); alter(r); assert.equal(retrieve(req, [r]).length, 0);
  }
});
test('training permission is independent of retrieval permission', () => { const r = approved(); r.rights.training = false; assert.equal(retrieve(req, [r]).length, 1); r.rights.retrieval = false; r.rights.training = true; assert.equal(retrieve(req, [r]).length, 0); });
test('thread exclusion works', () => { assert.equal(retrieve({ ...req, excludeThreads: ['real-1'] }, [approved()]).length, 0); });
test('content modification and stale approval fail validation', () => { const r = approved(); r.text += 'Changed.'; assert.throws(() => validateCorpus([r]), /hash/); r.source.contentHash = recordHash(r); assert.throws(() => validateCorpus([r]), /Approval/); });
test('duplicate ids and credential-bearing sources rejected', () => { assert.throws(() => validateCorpus([approved(), approved()]), /Duplicate/); const r = approved(); r.source.url = 'https://user:password@example.org'; assert.throws(() => validateCorpus([r]), /credential/); });
test('retrieval caps author, thread, duplicate text and total results', () => {
  const records = Array.from({ length: 6 }, (_, i) => { const r = approved(`r${i}`); r.text += ` Variation ${i}.`; r.source.contentHash = recordHash(r); r.review.reviewedHash = r.source.contentHash; return r; });
  assert.equal(retrieve(req, records).length, 3);
  records.forEach(r => r.source.author = 'same'); assert.equal(retrieve(req, records).length, 1);
});
test('oversized examples are skipped instead of silently truncated', () => { const r = approved(); r.context = 'x'.repeat(7000); r.source.contentHash = recordHash(r); r.review.reviewedHash = r.source.contentHash; assert.equal(retrieve(req, [r]).length, 0); });
test('check flags changed amount and missing explicit name', () => { const c = codes({ ...req, facts: ['Dana requested $400.'], protectedSpans: ['Dana', '$400'] }, 'Lee requested $500.'); assert.ok(c.includes('protected_span_missing')); assert.ok(c.includes('new_numeric_token')); });
test('check flags uncertainty, negation and condition loss', () => { const c = codes({ ...req, draft: 'We might proceed if approved. We cannot promise it.' }, 'We will proceed.'); for (const v of ['uncertainty_marker_removed', 'negation_marker_removed', 'condition_marker_removed']) assert.ok(c.includes(v)); });
test('check flags removed amounts, forbidden phrases and length', () => { const c = codes({ ...req, draft: 'It costs 40.', maxWords: 20, forbiddenPhrases: ['delve'] }, 'delve ' + 'word '.repeat(21)); for (const v of ['numeric_token_removed', 'word_limit', 'author_preference']) assert.ok(c.includes(v)); });
test('8-token source overlap flagged', () => { const r = approved(); assert.ok(codes(req, r.text, [r]).includes('source_overlap')); });
test('clean checks never claim semantic verification', () => { const c = check({ request: req, text: 'Dana approved Lee.' }); assert.equal(c.verdict, 'no_mechanical_flags'); assert.equal(c.requiresHumanReview, true); assert.match(c.limitations, /role reversals/); });
test('import captures opening and direct parent, with quarantine defaults', () => { const x = imported(topic()); assert.equal(x.records.length, 2); assert.match(x.records[1].context, /Which problem/); assert.equal(x.coverage.completeThread, true); assert.equal(x.records[1].source.parentPostNumber, 2); assert.equal(retrieve(req, x.records).length, 0); assert.ok(x.records.every(r => !r.rights.retrieval && !r.rights.training && !r.rights.externalProcessing)); });
test('import never mistakes partial stream for complete thread', () => { const t = topic(); t.post_stream.posts.splice(1, 1); const x = imported(t); assert.equal(x.coverage.completeThread, false); assert.deepEqual(x.coverage.missingPostIds, [102]); assert.equal(x.records[0].source.contextComplete, false); });
test('HTML-only, hidden and deleted posts are excluded', () => { const t = topic(); t.post_stream.posts[1] = { id: 102, post_number: 2, cooked: '<p>Only HTML</p>' }; t.post_stream.posts[2].hidden = true; assert.equal(imported(t).records.length, 0); });
test('duplicate identities and oversized export rejected', () => { const t = topic(); t.post_stream.posts[2].id = 102; assert.throws(() => imported(t)); t.post_stream.posts = Array(201).fill({}); assert.throws(() => imported(t)); });
test('invalid parent skipped; unknown and duplicate stream not called complete', () => { const t = topic(); t.post_stream.posts[2].reply_to_post_number = 3; assert.equal(imported(t).coverage.skipped[0].reason, 'invalid_parent'); t.post_stream.stream = [101, 101]; assert.equal(imported(t).coverage.completeThread, false); });
test('import rejects HTTP origin and source-supplied credentials', () => { for (const origin of ['http://example.org', 'https://x:y@example.org', 'https://example.org/path']) assert.throws(() => importDiscourse(topic(), { origin, retrievedAt: new Date().toISOString() })); });
test('feedback cannot be saved without explicit consent', () => { const f = feedback(); f.consentToStore = false; assert.throws(() => feedbackRecord(f), /consent/); });
test('feedback never grants training or shared-corpus rights', () => { const r = feedbackRecord(feedback()); assert.equal(r.trainingAllowed, false); assert.equal(r.sharedCorpusAllowed, false); assert.equal(r.preferenceInference, 'pending-human-review'); });
test('feedback requires opt-in directory outside repo', async () => { await assert.rejects(saveFeedback(feedback(), ''), /Set WRITING/); await assert.rejects(saveFeedback(feedback(), HERE), /outside/); });
test('feedback writes a private journal with restrictive permissions', async () => temporary(async dir => { const result = await saveFeedback(feedback(), dir); assert.equal(result.stored, true); const file = join(dir, 'writing-lab/feedback.jsonl'); assert.equal((await fs.stat(file)).mode & 0o077, 0); assert.equal(JSON.parse((await fs.readFile(file, 'utf8')).trim()).final, 'Edited text.'); }));
test('unsafe feedback directory and symlink refused', async () => temporary(async dir => { const target = join(dir, 'writing-lab'); await fs.mkdir(target, { mode: 0o755 }); await assert.rejects(saveFeedback(feedback(), dir), /private/); await fs.rmdir(target); await fs.symlink(HERE, target); await assert.rejects(saveFeedback(feedback(), dir)); }));
test('JSON reads bounded and symlinks refused; writes cannot overwrite', async () => temporary(async dir => { const path = join(dir, 'data.json'); await writeNewJson(path, { a: 1 }); assert.deepEqual(await readJson(path), { a: 1 }); await assert.rejects(writeNewJson(path, {})); await fs.symlink(path, path + '.link'); await assert.rejects(readJson(path + '.link')); await fs.writeFile(path, 'x'.repeat(MAX_BYTES + 1)); await assert.rejects(readJson(path), /4 MiB/); }));
test('stdin is byte-bounded', async () => { await assert.rejects(readStdin(Readable.from(['12345']), 4), /limit/); });
test('blind comparisons stable and key separated', () => { const rows = ['baseline', 'skill', 'examples'].map((condition, i) => ({ taskId: 't', condition, text: `Candidate ${i}` })); const a = blindEvaluation(rows, 'test-seed'); assert.deepEqual(a, blindEvaluation(rows, 'test-seed')); assert.ok(!JSON.stringify(a.blind).includes('condition')); assert.equal(Object.keys(a.key[0].labels).length, 3); });
test('blind evaluation rejects missing conditions, duplicates and empty batches', () => { for (const rows of [[], [{ taskId: 't', condition: 'baseline', text: 'One' }], [{ taskId: 't', condition: 'baseline', text: 'One' }, { taskId: 't', condition: 'baseline', text: 'Two' }]]) assert.throws(() => blindEvaluation(rows, 'test-seed')); });
test('writer default disabled before any network call', async () => { let called = false; await assert.rejects(createWriter({ env: {}, fetchImpl: async () => { called = true; } })(req, fixtures), /disabled/); assert.equal(called, false); });
test('writer uses fixed provider, separates instructions/data and returns partial checks', async () => { let sent; const write = createWriter({ env, fetchImpl: async (url, options) => { sent = { url, options, body: JSON.parse(options.body) }; return response(); } }); const out = await write(req, [approved()]); assert.equal(sent.url, 'https://api.anthropic.com/v1/messages'); assert.equal(sent.options.redirect, 'error'); assert.equal(sent.body.max_tokens, 2048); assert.equal(out.review.requiresHumanReview, true); assert.equal(out.sent, false); });
test('external model cannot receive examples without external processing permission', async () => { const r = approved(); r.rights.externalProcessing = false; let sent; const write = createWriter({ env, fetchImpl: async (_, options) => { sent = JSON.parse(JSON.parse(options.body).messages[0].content); return response(); } }); await write(req, [r]); assert.equal(sent.examples.length, 0); });
test('provider errors and truncation withhold output; no automatic retry', async () => { let count = 0; const write = createWriter({ env, fetchImpl: async () => { count++; return new Response('PRIVATE ERROR BODY', { status: 429 }); } }); await assert.rejects(write(req, []), e => e.message === 'Writer provider HTTP 429'); assert.equal(count, 1); await assert.rejects(createWriter({ env, fetchImpl: async () => response({ stop_reason: 'max_tokens' }) })(req, []), /withheld/); });
test('writer enforces process call ceiling', async () => { let count = 0; const write = createWriter({ env, fetchImpl: async () => { count++; return response(); } }); for (let i = 0; i < 10; i++) await write(req, []); await assert.rejects(write(req, []), /limit/); assert.equal(count, 10); });
test('oversized provider response rejected', async () => { await assert.rejects(createWriter({ env, fetchImpl: async () => new Response('x'.repeat(256 * 1024 + 1)) })(req, []), /limit/); });
test('MCP initialization negotiates supported protocol; preinit tools blocked', async () => { const s = createSession({ getCorpus: async () => [] }); assert.equal((await s(msg(1, 'tools/list'))).error.code, -32000); const m = init(); m.params.protocolVersion = 'unknown'; assert.equal((await s(m)).result.protocolVersion, '2025-11-25'); assert.equal((await s(msg(2, 'tools/list'))).error.code, -32000); assert.equal(await s(initialized), null); assert.ok((await s(msg(2, 'tools/list'))).result.tools); });
test('MCP unknown notifications get no response; ping works', async () => { const s = await ready(); assert.equal(await s({ jsonrpc: '2.0', method: 'notifications/unknown' }), null); assert.deepEqual((await s(msg(3, 'ping'))).result, {}); });
test('MCP hides paid and storage tools until explicitly configured', async () => { const s = await ready(); assert.deepEqual((await s(msg(3, 'tools/list'))).result.tools.map(x => x.name), ['prepare_writing', 'check_writing']); assert.equal((await s(msg(4, 'tools/call', { name: 'write_draft' }))).error.code, -32602); });
test('MCP reloads corpus and respects revocation on next call', async () => { const r = approved(); const s = await ready({ getCorpus: async () => [r] }); const call = () => s(msg(3, 'tools/call', { name: 'prepare_writing', arguments: req })); assert.equal((await call()).result.structuredContent.examples.length, 1); r.revoked = true; assert.equal((await call()).result.structuredContent.examples.length, 0); });
test('MCP tool errors do not echo arbitrary input or filesystem details', async () => { const s = await ready({ getCorpus: async () => { throw new Error('secret-provider-key'); } }); const out = await s(msg(3, 'tools/call', { name: 'prepare_writing', arguments: req })); assert.equal(out.result.isError, true); assert.ok(!JSON.stringify(out).includes('secret-provider-key')); });
test('MCP rejects invalid requests, repeated initialize and invalid params', async () => { const s = await ready(); assert.equal((await s(null)).error.code, -32600); assert.equal((await s([])).error.code, -32600); assert.equal((await s(init())).error.code, -32600); });
test('stdio handles chunk boundaries, parse errors, oversized frame recovery and notifications', async () => {
  let text = ''; const out = new Writable({ write(chunk, _, callback) { text += chunk.toString(); callback(); } });
  const stream = JSON.stringify(init()) + '\n' + JSON.stringify(initialized) + '\nINVALID\n' + 'x'.repeat(262145) + '\n' + JSON.stringify(msg(3, 'tools/list')) + '\n';
  await serve(Readable.from([stream.slice(0, 13), stream.slice(13)]), out, createSession({ getCorpus: async () => [], allowWrite: false, allowFeedback: false }));
  const rows = text.trim().split('\n').map(x => JSON.parse(x)); assert.equal(rows.length, 4); assert.equal(rows[1].error.code, -32700); assert.equal(rows[2].error.code, -32600); assert.equal(rows[3].result.tools.length, 2);
});
test('real MCP child process completes initialize, list and prepare with only JSON stdout', () => {
  const messages = [init(), initialized, msg(2, 'tools/list'), msg(3, 'tools/call', { name: 'prepare_writing', arguments: { ...req, includeIllustrative: true } })];
  const child = spawnSync(process.execPath, [join(HERE, 'mcp.mjs')], { input: messages.map(x => JSON.stringify(x)).join('\n') + '\n', encoding: 'utf8', env: cleanEnv, timeout: 5000 });
  assert.equal(child.status, 0); assert.equal(child.stderr, ''); const rows = child.stdout.trim().split('\n').map(x => JSON.parse(x)); assert.equal(rows.length, 3); assert.equal(rows[2].result.structuredContent.examples.length, 2);
});
test('real CLI demo runs without installing dependencies or using keys', () => { const child = spawnSync(process.execPath, [join(HERE, 'cli.mjs'), 'prepare', '--input', join(HERE, 'demo-request.json'), '--demo'], { encoding: 'utf8', env: cleanEnv, timeout: 5000 }); assert.equal(child.status, 0); assert.equal(JSON.parse(child.stdout).examples.length, 2); });
test('CLI malformed JSON does not disclose the input', () => { const child = spawnSync(process.execPath, [join(HERE, 'cli.mjs'), 'prepare'], { input: '{PRIVATE_CONTENT', encoding: 'utf8', env: cleanEnv, timeout: 5000 }); assert.equal(child.status, 1); assert.ok(!child.stderr.includes('PRIVATE_CONTENT')); });
test('evaluation task starter contains 12 valid distinct requests', async () => { const tasks = await readJson(join(HERE, 'eval-tasks.json')); assert.equal(tasks.length, 12); assert.equal(new Set(tasks.map(t => t.taskId)).size, 12); tasks.forEach(t => parseRequest(t.request)); });
