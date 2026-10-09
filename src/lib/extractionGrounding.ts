/**
 * Grounding for the structured fields the corpus classifier extracts
 * (deadline, amounts, currency, program). A field survives only if the
 * source text states it in some written form; otherwise it becomes null.
 *
 * The first version of the canonical path accepted a deadline only when the
 * source contained it literally as YYYY-MM-DD, and extracted no amounts or
 * program at all. Forum posts write "1 November 2026", so in the first eleven
 * days not one published item carried a deadline, amount or program name,
 * while the legacy classifier had them on most rows (2026-10-09). Grounding
 * keeps the anti-invention rule without requiring machine formatting.
 */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthPattern = (m: number) => {
  const full = MONTHS[m - 1];
  const short = full.slice(0, 3);
  return m === 9 ? `(?:${full}|sept|${short})` : full === short ? full : `(?:${full}|${short})`;
};

const flat = (s: string) => s.toLowerCase().replace(/[   ]/g, ' ').replace(/\s+/g, ' ');

/**
 * The ISO date (YYYY-MM-DD) is accepted when the text mentions that calendar
 * day: as ISO, or with a month name in day-first or month-first order, with
 * or without an ordinal suffix. A mention without a year counts only when the
 * year is the posting year or the next one (a January deadline in a December
 * post). Numeric forms like 11/01/2026 are ambiguous between locales and are
 * not accepted unless the day is over 12.
 */
export function dateMentioned(iso: string, text: string, postedYear: number | null): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const t = flat(text);
  if (t.includes(iso)) return true;
  const yearOk = (y: string | undefined) => (y ? Number(y) === year : postedYear == null ? false : year === postedYear || year === postedYear + 1);
  const d = `0?${day}(?:st|nd|rd|th)?`;
  const mon = monthPattern(month);
  const dayFirst = new RegExp(`(?<![\\d])${d}(?:\\s+of)?[\\s.,-]+${mon}\\b\\.?(?:,?\\s+(\\d{4}))?`, 'g');
  const monthFirst = new RegExp(`\\b${mon}\\b\\.?\\s+${d}(?![\\d])(?:,?\\s+(\\d{4}))?`, 'g');
  // A range states its last day as the deadline: "August 4–25", "4–25 August".
  const monthFirstRange = new RegExp(`\\b${mon}\\b\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*(?:[-–—]|to|until|through)\\s*${d}(?![\\d])(?:,?\\s+(\\d{4}))?`, 'g');
  const dayFirstRange = new RegExp(`(?<![\\d])\\d{1,2}(?:st|nd|rd|th)?\\s*(?:[-–—]|to)\\s*${d}\\s+${mon}\\b\\.?(?:,?\\s+(\\d{4}))?`, 'g');
  for (const re of [dayFirst, monthFirst, monthFirstRange, dayFirstRange]) {
    for (const hit of t.matchAll(re)) if (yearOk(hit[1])) return true;
  }
  // "end of September 2024" names the month's last day.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day === lastDay) {
    const endOf = new RegExp(`\\b(?:the\\s+)?end\\s+of\\s+${mon}\\b(?:,?\\s+(\\d{4}))?`, 'g');
    for (const hit of t.matchAll(endOf)) if (yearOk(hit[1])) return true;
  }
  if (day > 12) {
    const dd = String(day), mm = String(month);
    const numeric = new RegExp(`(?<![\\d/.])(?:0?${dd}[/.]0?${mm}|0?${mm}[/.]0?${dd})[/.](\\d{4}|\\d{2})(?![\\d])`, 'g');
    for (const hit of t.matchAll(numeric)) if (hit[1].length === 4 ? Number(hit[1]) === year : Number(hit[1]) === year % 100) return true;
  }
  return false;
}

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };

/** Every number the text states, with k/m/b and million/billion scaling applied. */
export function statedNumbers(text: string): number[] {
  const out: number[] = [];
  // Thousands separators include the Swiss apostrophe ("$10’000"); a number may be glued to the
  // next word ("40904USD", "$113,602for"), so only a scale suffix must end at a word boundary.
  const re = /(\d{1,3}(?:[,   '’]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s?(k|thousand|mm|mn|m|million|bn|b|billion)(?![a-z]))?/gi;
  for (const hit of text.matchAll(re)) {
    const base = Number(hit[1].replace(/[,   '’]/g, ''));
    if (!Number.isFinite(base)) continue;
    const scale = hit[2] ? SCALE[hit[2].toLowerCase()] ?? 1 : 1;
    out.push(base * scale);
    if (scale === 1 && base >= 1000 && /\.\d{3}/.test(hit[1])) out.push(Number(hit[1].replace(/\./g, '')));
  }
  return out;
}

/** An amount is grounded when the text states that number (exactly, after k/m scaling). */
export function amountMentioned(n: number, text: string): boolean {
  if (!Number.isFinite(n) || n <= 0) return false;
  return statedNumbers(text).some(v => Math.abs(v - n) <= Math.max(0.5, n * 1e-9));
}

const SYMBOL_CURRENCY: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };

/** Upper-cased currency/token code, accepted only when the text names it or uses its symbol. */
export function currencyMentioned(code: string, text: string): string | null {
  // "$AURORA" and "$BAL" are token tickers written with a dollar sign, not dollars.
  const raw = code.trim().toUpperCase().replace(/^US\$$/, 'USD').replace(/^\$(?=[A-Z])/, '');
  const fromSymbol = SYMBOL_CURRENCY[raw];
  const iso = fromSymbol ?? raw;
  if (!/^[A-Z0-9.]{2,12}$/.test(iso)) return null;
  const symbol = fromSymbol ? raw : Object.entries(SYMBOL_CURRENCY).find(([, v]) => v === iso)?.[0];
  if (symbol && text.includes(symbol)) return iso;
  return new RegExp(`(?<![a-z0-9])${iso.replace(/\./g, '\\.')}(?![a-z0-9])`, 'i').test(text) ? iso : null;
}

/** A program name is kept only if it appears in the text (case and spacing aside) and the
 *  title does not already contain it: the brief prints both, and 97 of 247 grounded legacy
 *  names merely repeated the title ("Radicle CI Integrations" on "Radicle CI Integrations").
 *  It earns its place when the title omits it ("Radicle Grants Program" on "Radicle IDE Plugins"). */
export function programMentioned(name: string, text: string, title = ''): string | null {
  const p = name.trim().replace(/\s+/g, ' ');
  if (p.length < 3 || p.length > 160) return null;
  if (!flat(text).includes(flat(p))) return null;
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const t = words(title), q = words(p);
  if (t && ` ${t} `.includes(` ${q} `)) return null;
  return p;
}
