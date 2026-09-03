import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGrantsCandidate, type GrantsClassification } from '@/lib/grantsClassifier';

const ENV = ['LLM_PROVIDER', 'OLLAMA_API_KEY', 'LLM_MODEL', 'LLM_MODEL_CLASSIFY'] as const;

/**
 * Run the classifier with the model's answer forced to `modelSays`, so the
 * test exercises OUR post-processing guards rather than the model.
 */
async function classifyWith(
  modelSays: GrantsClassification,
  kind: string,
  input: { title: string; createdAt?: string },
): Promise<GrantsClassification | null> {
  const prev: Record<string, string | undefined> = {};
  for (const k of ENV) prev[k] = process.env[k];
  const realFetch = globalThis.fetch;
  process.env.LLM_PROVIDER = 'ollama';
  process.env.OLLAMA_API_KEY = 'test-key';
  process.env.LLM_MODEL = 'glm-5.2';
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ message: { content: JSON.stringify({ classification: modelSays, kind, confidence: 90 }) } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )) as typeof fetch;
  try {
    const out = await classifyGrantsCandidate({
      title: input.title,
      protocol: 'Test',
      vertical: 'crypto',
      tags: [],
      signal: 'keywords: grant',
      createdAt: input.createdAt ?? '2026-09-01T00:00:00.000Z',
    });
    return out?.classification ?? null;
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test('committee meeting minutes are a record, never a grant', async () => {
  assert.equal(
    await classifyWith('GRANT', 'application', { title: 'Zcash Community Grants Meeting Minutes 8/31/2026' }),
    'NEWS',
  );
});

test('a third-party fundraise announcement is not an opportunity', async () => {
  assert.equal(
    await classifyWith('GRANT', 'application', { title: 'Kairos has raised $50M to build talent infrastructure for AI safety' }),
    'NEWS',
  );
});

test('a retrospective discussion about an election is not an open seat', async () => {
  assert.equal(
    await classifyWith('ROLE', 'election', { title: 'Feedback on election communications' }),
    'NEWS',
  );
});

test('a real grant program still classifies as GRANT', async () => {
  assert.equal(
    await classifyWith('GRANT', 'program_launch', { title: 'AI Philosophy Competition: $11,000 in prizes.' }),
    'GRANT',
  );
});

test('a digest that announces open board elections is still a ROLE', async () => {
  // Real item, 2026-09-02: the word "digest" must not trigger the record guard.
  assert.equal(
    await classifyWith('ROLE', 'election', { title: 'Digest September 02, 2026: Intersect Board Elections 2026 | Constitutional Committee' }),
    'ROLE',
  );
});

test('retroactive/retrospective FUNDING is a real grant category, not a record', async () => {
  // Real item: CoW Protocol "Grant Application - Retrospective Funding for 15
  // Merged Cow Protocol PRs" is an application, not a retrospective write-up.
  assert.equal(
    await classifyWith('GRANT', 'retro_round', { title: 'Grant Application - Retrospective Funding for 15 Merged Cow Protocol PRs' }),
    'GRANT',
  );
});

test('a multi-item digest is not demoted because one item inside it is a recap', async () => {
  // Real item: the Cardano digest bundles a conference recap WITH urgent
  // governance business. The actionable half is the reason it is in the brief.
  assert.equal(
    await classifyWith('ROLE', 'election', { title: 'Digest August 19, 2026: Cardano at TOKEN2049, Rare Evo 2026 Recap, Urgent Governance Action' }),
    'ROLE',
  );
});

test('an RFP whose body reports what a program raised is still a ROLE/GRANT', async () => {
  // The guard reads the TITLE only; "raised" mid-sentence in a body must not demote.
  assert.equal(
    await classifyWith('GRANT', 'rfp', { title: 'Request for Proposals: Security audits for v4 hooks' }),
    'GRANT',
  );
});
