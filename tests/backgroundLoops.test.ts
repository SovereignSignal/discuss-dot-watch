import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldStartBackgroundLoops,
  startBackgroundLoops,
  getBackgroundLoopsState,
  type BackgroundLoopDeps,
} from '@/lib/backgroundLoops';
import { register } from '@/instrumentation';

/** Env patch that stays applied until an async `fn` settles (a sync
 *  finally would restore the env while a dynamic import is still pending). */
async function withEnv<T>(patch: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) {
    prev[k] = process.env[k];
    if (patch[k] === undefined) delete process.env[k];
    else process.env[k] = patch[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(patch)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test('shouldStartBackgroundLoops is false during next build', () => {
  assert.equal(shouldStartBackgroundLoops({ NEXT_PHASE: 'phase-production-build' }), false);
  assert.equal(shouldStartBackgroundLoops({ NEXT_PHASE: 'phase-development-build' }), false);
});

test('shouldStartBackgroundLoops is true for a running server', () => {
  assert.equal(shouldStartBackgroundLoops({}), true);
  assert.equal(shouldStartBackgroundLoops({ NEXT_PHASE: 'phase-production-server' }), true);
});

test('register() does nothing outside the nodejs runtime', async () => {
  await withEnv({ NEXT_RUNTIME: undefined }, () => register());
  assert.equal(getBackgroundLoopsState(), 'idle');
});

test('register() reaches the loop starter on the nodejs runtime (build phase → skipped)', async () => {
  await withEnv({ NEXT_RUNTIME: 'nodejs', NEXT_PHASE: 'phase-production-build' }, () => register());
  assert.equal(getBackgroundLoopsState(), 'skipped');
});

test('startBackgroundLoops starts every loop exactly once at runtime', async () => {
  const calls = { refresh: 0, delegates: 0, brief: 0, schema: 0 };
  const deps: BackgroundLoopDeps = {
    startBackgroundRefresh: () => { calls.refresh++; },
    startDelegateRefreshLoop: () => { calls.delegates++; },
    startDailyBriefLoop: () => { calls.brief++; },
    initSchema: () => { calls.schema++; },
  };

  const first = await withEnv({ NEXT_PHASE: undefined }, () => startBackgroundLoops(deps));
  assert.equal(first, 'started');
  assert.deepEqual(calls, { refresh: 1, delegates: 1, brief: 1, schema: 1 });

  const second = await withEnv({ NEXT_PHASE: undefined }, () => startBackgroundLoops(deps));
  assert.equal(second, 'started');
  assert.deepEqual(calls, { refresh: 1, delegates: 1, brief: 1, schema: 1 }, 'second call must not restart loops');
  assert.equal(getBackgroundLoopsState(), 'started');
});
