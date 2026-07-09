/**
 * In-process daily scheduler for the Daily Brief — the system previously
 * had NO scheduler at all (the cron endpoint existed but nothing called
 * it). Same pattern as the delegate refresh loop: registered as a
 * side-effect of the first /api/discourse import, hourly ticks, and
 * the Postgres day-claim in dailyBrief.ts (atomic INSERT, fail-closed) makes
 * it exactly-once per day even across instance restarts or a racing
 * external pinger.
 *
 * Sends at or after SEND_HOUR_UTC (14:00 UTC ≈ 7am PT) on the first
 * hourly tick of the window.
 */

import { runDailyBrief } from './dailyBrief';
import { isDatabaseConfigured } from './db';

const SEND_HOUR_UTC = 14;
const INITIAL_DELAY_MS = 5 * 60 * 1000;   // let the process settle after boot
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

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
  console.log(`[DailyBrief] Loop registered — sends daily at/after ${SEND_HOUR_UTC}:00 UTC`);
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
