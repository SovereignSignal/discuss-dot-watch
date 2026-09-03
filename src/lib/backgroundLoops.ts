/**
 * Background loop bootstrap — the ONE place the server's long-running jobs
 * start: forum cache refresh (→ grants scan), delegate refresh, and the
 * Daily Brief scheduler.
 *
 * Called from src/instrumentation.ts `register()`, which Next.js runs once
 * per server boot. Before this existed the loops started as a side effect of
 * importing the /api/discourse route module, and Next.js loads route modules
 * on their FIRST REQUEST — so after every deploy the whole pipeline sat idle
 * until someone opened the reader app (dead zones Aug 13-17, Aug 23-30 and
 * Sep 1 2026; briefs went missing on those days).
 *
 * The real starters are loaded lazily: importing forumCache/db/redis has
 * connection side effects that don't belong in the edge bundle or in tests.
 * Idempotent and race-safe (one in-flight start is shared).
 */

export type BackgroundLoopsState = 'idle' | 'skipped' | 'started';

export interface BackgroundLoopDeps {
  startBackgroundRefresh(): void;
  startDelegateRefreshLoop(): void;
  startDailyBriefLoop(): void;
  initSchema(): void;
}

async function loadDefaultDeps(): Promise<BackgroundLoopDeps> {
  const [forumCache, refreshEngine, briefLoop, db] = await Promise.all([
    import('./forumCache'),
    import('./delegates/refreshEngine'),
    import('./dailyBriefLoop'),
    import('./db'),
  ]);
  return {
    startBackgroundRefresh: forumCache.startBackgroundRefresh,
    startDelegateRefreshLoop: refreshEngine.startDelegateRefreshLoop,
    startDailyBriefLoop: briefLoop.startDailyBriefLoop,
    initSchema: () => {
      // Forward-compatible schema migrations at boot. Previously these only
      // ran via admin endpoints, so ALTER TABLE migrations never reached
      // production and the queries using them 500'd.
      if (db.isDatabaseConfigured()) {
        db.initializeSchema().catch(err => {
          console.error('[Schema] Boot-time schema init failed:', err);
        });
      }
    },
  };
}

let state: BackgroundLoopsState = 'idle';
let inflight: Promise<BackgroundLoopsState> | null = null;

/**
 * `next build` imports route modules; a full cache refresh + grants scan
 * (and an Ollama classify burst) must never run inside an image build.
 */
export function shouldStartBackgroundLoops(env: Partial<NodeJS.ProcessEnv> = process.env): boolean {
  const phase = env.NEXT_PHASE;
  if (phase === 'phase-production-build' || phase === 'phase-development-build') return false;
  return true;
}

export function getBackgroundLoopsState(): BackgroundLoopsState {
  return state;
}

/** Start every background loop once. Resolves to the resulting state. */
export function startBackgroundLoops(deps?: BackgroundLoopDeps): Promise<BackgroundLoopsState> {
  if (state === 'started') return Promise.resolve(state);
  if (!shouldStartBackgroundLoops()) {
    state = 'skipped';
    return Promise.resolve(state);
  }
  if (!inflight) {
    inflight = (async () => {
      const d = deps ?? await loadDefaultDeps();
      d.startBackgroundRefresh();
      d.startDelegateRefreshLoop();
      d.startDailyBriefLoop();
      d.initSchema();
      state = 'started';
      console.log('[Boot] Background loops started (cache refresh, delegate refresh, daily brief)');
      return state;
    })().catch(err => {
      inflight = null; // let a later caller retry
      throw err;
    });
  }
  return inflight;
}
