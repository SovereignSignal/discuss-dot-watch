/**
 * Rolling date-range windows shared by the client feed filter and
 * /api/discussions.
 *
 * "today" = last 24h, "week" = last 7 days, "month" = last 30 days —
 * rolling from now, not calendar-aligned. Calendar semantics
 * (date-fns isThisWeek/isThisMonth) emptied the default feed at every
 * week/month boundary: on a Sunday, a topic created Saturday failed
 * the "week" filter.
 */

const WINDOW_MS: Record<string, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

/** Clock skew allowance before a future-dated topic is excluded. */
const FUTURE_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Whether a date falls inside the rolling window for `range`.
 * Unknown ranges (including 'all') apply no filtering; invalid dates
 * are excluded rather than silently passing every filter. The typeof
 * check also keeps Object.prototype key names ('constructor', …) in a
 * query param from being treated as windows.
 */
export function isWithinDateRange(
  dateValue: string | Date,
  range: string,
  now: number = Date.now(),
): boolean {
  const windowMs = WINDOW_MS[range];
  if (typeof windowMs !== 'number') return true;
  const t = new Date(dateValue).getTime();
  if (Number.isNaN(t)) return false;
  const age = now - t;
  return age <= windowMs && age >= -FUTURE_SKEW_TOLERANCE_MS;
}
