/**
 * In-process daily scheduler for the Daily Brief — the system previously
 * had NO scheduler at all (the cron endpoint existed but nothing called
 * it). Same pattern as the delegate refresh loop: started at server boot
 * by instrumentation.ts via backgroundLoops.ts, hourly ticks, and
 * the Postgres day-claim in dailyBrief.ts (atomic INSERT, fail-closed) makes
 * it exactly-once per day even across instance restarts or a racing
 * external pinger.
 *
 * Sends at or after SEND_HOUR_UTC (14:00 UTC ≈ 7am PT) on the first
 * hourly tick of the window. Ticks are aligned to TICK_MINUTE past the hour:
 * counted from boot, every deploy used to move the send time by up to an
 * hour (the 2026-10-07 deploy at 12:41 pushed the brief from 14:15 to 14:46).
 * One catch-up tick still runs shortly after boot, so a deploy that lands
 * after 14:00 on an unsent day mails without waiting for the next hour.
 */

import { runDailyBrief } from './dailyBrief';
import { isDatabaseConfigured } from './db';

const SEND_HOUR_UTC = 14;
const INITIAL_DELAY_MS = 5 * 60 * 1000;   // let the process settle after boot
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
export const TICK_MINUTE = 5;

/** Milliseconds from `now` to the next HH:TICK_MINUTE:00 UTC, never zero. */
export function msUntilNextAlignedTick(now = Date.now()): number {
  const next = new Date(now);
  next.setUTCMinutes(TICK_MINUTE, 0, 0);
  if (next.getTime() <= now) next.setUTCHours(next.getUTCHours() + 1);
  return next.getTime() - now;
}

let started = false;
let warnedNoResend = false;

async function tick(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!process.env.RESEND_API_KEY) {
    // Loud once: a silently-skipping loop looks identical to a healthy one,
    // and a week of silence permanently expires items past the freshness window.
    if (!warnedNoResend) {
      warnedNoResend = true;
      console.error('[DailyBrief] RESEND_API_KEY not configured — daily brief will NOT send');
    }
    return;
  }
  if (new Date().getUTCHours() < SEND_HOUR_UTC) return;
  try {
    const result = await runDailyBrief();
    if (!result.sent && result.reason !== 'Already sent today' && result.reason !== 'No new items') {
      console.log(`[DailyBrief] Loop tick: not sent — ${result.reason}`);
    }
  } catch (error) {
    // runDailyBrief released the day's claim — the next hourly tick retries.
    console.error('[DailyBrief] Loop tick failed:', error);
  }
}

export function startDailyBriefLoop(): void {
  if (started) return;
  started = true;
  console.log(`[DailyBrief] Loop registered — sends daily at/after ${SEND_HOUR_UTC}:00 UTC, checks at :${String(TICK_MINUTE).padStart(2, '0')}`);
  setTimeout(() => void tick(), INITIAL_DELAY_MS); // catch-up after boot
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), CHECK_INTERVAL_MS);
  }, msUntilNextAlignedTick());
}
