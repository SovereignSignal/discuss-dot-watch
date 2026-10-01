/**
 * Next.js instrumentation hook — runs once per server boot, BEFORE any
 * request. This is what makes the background loops start on deploy instead
 * of on the first visitor (see lib/backgroundLoops.ts for the history).
 *
 * The hook also runs for the edge runtime, where timers and Node APIs are
 * unavailable, so only the nodejs runtime starts anything. The dynamic
 * import keeps Node-only modules out of the edge bundle.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startBackgroundLoops } = await import('@/lib/backgroundLoops');
  // Not awaited: boot must not wait on loop setup. But a rejection here was
  // unhandled, so a failed start produced no `[Boot]` line and no error.
  startBackgroundLoops().catch(err => {
    console.error('[Boot] Background loops failed to start:', err);
  });
}
