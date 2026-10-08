import test from 'node:test';
import assert from 'node:assert/strict';
import { msUntilNextAlignedTick, TICK_MINUTE } from '@/lib/dailyBriefLoop';

const at = (iso: string) => Date.parse(iso);

test('hourly checks land at a fixed minute, so a deploy no longer moves the send time', () => {
  assert.equal(TICK_MINUTE, 5);
  // Oct 7 deploy booted at 12:41; the first aligned check is 13:05, then 14:05 sends.
  assert.equal(msUntilNextAlignedTick(at('2026-10-07T12:41:13Z')), at('2026-10-07T13:05:00Z') - at('2026-10-07T12:41:13Z'));
  assert.equal(msUntilNextAlignedTick(at('2026-10-07T13:04:59Z')), 1000);
});

test('exactly on the tick minute schedules the next hour, never a zero delay', () => {
  assert.equal(msUntilNextAlignedTick(at('2026-10-07T14:05:00Z')), 60 * 60 * 1000);
  assert.equal(msUntilNextAlignedTick(at('2026-10-07T23:30:00Z')), at('2026-10-08T00:05:00Z') - at('2026-10-07T23:30:00Z'));
});
