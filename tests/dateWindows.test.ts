import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinDateRange } from '@/lib/dateWindows';

const now = Date.parse('2026-07-17T12:00:00.000Z');

test('date windows use rolling boundaries', () => {
  assert.equal(isWithinDateRange('2026-07-16T12:00:00.000Z', 'today', now), true);
  assert.equal(isWithinDateRange('2026-07-16T11:59:59.999Z', 'today', now), false);
  assert.equal(isWithinDateRange('2026-07-10T12:00:00.000Z', 'week', now), true);
  assert.equal(isWithinDateRange('2026-06-17T12:00:00.000Z', 'month', now), true);
});

test('invalid dates are excluded only when a real window is active', () => {
  assert.equal(isWithinDateRange('not-a-date', 'week', now), false);
  assert.equal(isWithinDateRange('not-a-date', 'all', now), true);
  assert.equal(isWithinDateRange('2026-07-17T12:05:01.000Z', 'today', now), false);
});
