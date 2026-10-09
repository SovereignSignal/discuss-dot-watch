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
 *
 * A grounded value is trusted downstream, and a deadline in the past closes
 * an item and lets the revalidation sweep withdraw it, so false positives
 * matter as much as recall. The PR #98 review found real ones ("Step 1 may"
 * as May 1, "web3" as an amount of 3, "$OP" as dollars); each rule below
 * names the case it guards against, and tests pin them.
 */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthPattern = (m: number) => {
  const full = MONTHS[m - 1];
  const short = full.slice(0, 3);
  return m === 9 ? `(?:${full}|sept|${short})` : full === short ? full : `(?:${full}|${short})`;
};

/** Whitespace collapsed, case preserved (bare "May"/"March" must be capitalised). */
const collapse = (s: string) => s.replace(/[   ]/g, ' ').replace(/\s+/g, ' ');
const flat = (s: string) => collapse(s).toLowerCase();

/** A date counts as a deadline only next to deadline language: "deadline", "due", "closes", "apply by"... */
const DEADLINE_CUE = /\b(?:deadlines?|due|clos(?:e|es|ed|ing)|until|till|by|before|no later than|submit|submissions?|apply|applications?|nominations?|ends?|ending|last day|cut-?off|expires?|expiring|accepting|window)\b/i;
/** ...and never right after an opening word: "opens November 1 and closes November 30" (PR #98 review). */
const OPENING_CUE = /\b(?:opens?|opening|opened|starts?|starting|begins?|beginning|launch(?:es|ing)?|kicks? off|from|since)\s*(?:on\s+|at\s+)?$/i;

/** The ISO date (YYYY-MM-DD) is accepted when the text mentions that calendar
 *  day next to deadline language: as ISO, with a month name in either order
 *  (ordinals allowed), as a range ending that day ("August 4–25"), as "end of
 *  <month>", or numerically when unambiguous (day over 12, four-digit year).
 *  A mention without a year counts only for the posting year or the next. */
export function dateMentioned(iso: string, text: string, postedYear: number | null): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const t = collapse(text);
  const yearOk = (y: string | undefined) => (y ? Number(y) === year : postedYear == null ? false : year === postedYear || year === postedYear + 1);
  const cued = (start: number, end: number) => {
    const before = t.slice(Math.max(0, start - 70), start);
    if (OPENING_CUE.test(before.slice(-25))) return false;
    // "Launch: November 1 (applications open)" is an opening date even though "applications" follows it.
    if (/^\W*\(?\s*(?:applications?|submissions?|nominations?|the round|round|registration)?\s*(?:are\s+|is\s+)?(?:now\s+)?(?:opens?|opening|starts?|begins?|launch(?:es)?)\b/i.test(t.slice(end, end + 30))) return false;
    return DEADLINE_CUE.test(before) || DEADLINE_CUE.test(t.slice(end, end + 30));
  };
  // "Step 1 may require", "Phase 2 march": a bare May/March must be the capitalised month.
  const monthCaseOk = (hit: string) => (month !== 3 && month !== 5) || /\b(?:May|MAY|Mar|MAR|March|MARCH)\b/.test(hit);
  const d = `0?${day}(?:st|nd|rd|th)?`;
  const mon = monthPattern(month);
  const forms: Array<{ re: RegExp; yearGroup: number | null }> = [
    // ISO, alone or with a time attached ("due 2026-11-01T23:59:00Z").
    { re: new RegExp(`(?<![\\w-])${iso}(?![\\d-])`, 'g'), yearGroup: null },
    // "1 November 2026", "1st of November"; the day must start a word ("Q1. Oct" is not a date).
    { re: new RegExp(`(?<![\\w.])${d}(?:\\s+of)?[\\s.]+${mon}\\b\\.?(?:,?\\s+(\\d{4}))?`, 'gi'), yearGroup: 1 },
    { re: new RegExp(`\\b${mon}\\b\\.?\\s+${d}(?![\\d])(?:,?\\s+(\\d{4}))?`, 'gi'), yearGroup: 1 },
    // A range states its last day as the deadline: "August 4–25", "4–25 August".
    { re: new RegExp(`\\b${mon}\\b\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*(?:[-–—]|to|until|through)\\s*${d}(?![\\d])(?:,?\\s+(\\d{4}))?`, 'gi'), yearGroup: 1 },
    { re: new RegExp(`(?<![\\w.])\\d{1,2}(?:st|nd|rd|th)?\\s*(?:[-–—]|to)\\s*${d}\\s+${mon}\\b\\.?(?:,?\\s+(\\d{4}))?`, 'gi'), yearGroup: 1 },
  ];
  // "end of September 2024" names the month's last day.
  if (day === new Date(Date.UTC(year, month, 0)).getUTCDate()) forms.push({ re: new RegExp(`\\b(?:the\\s+)?end\\s+of\\s+${mon}\\b(?:,?\\s+(\\d{4}))?`, 'gi'), yearGroup: 1 });
  // Numeric dates only when unambiguous across locales, with a four-digit year ("v2.13.26" is a version).
  if (day > 12) forms.push({ re: new RegExp(`(?<![\\w/.])(?:0?${day}[/.]0?${month}|0?${month}[/.]0?${day})[/.](\\d{4})(?![\\d])`, 'g'), yearGroup: 1 });
  for (const { re, yearGroup } of forms) {
    for (const hit of t.matchAll(re)) {
      const y = yearGroup == null ? String(year) : hit[yearGroup];
      if (!yearOk(y) || !monthCaseOk(hit[0])) continue;
      if (cued(hit.index ?? 0, (hit.index ?? 0) + hit[0].length)) return true;
    }
  }
  return false;
}

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
const FIAT = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SGD', 'INR', 'BRL', 'NOK', 'SEK', 'DKK']);
/** Capitalised words that follow numbers in grant posts without being money ("10 AI projects", "3 DAO seats"). */
const NOT_CURRENCY = new Set(['AI', 'ML', 'DAO', 'DAOS', 'API', 'APIS', 'UI', 'UX', 'ZK', 'PR', 'PRS', 'RFP', 'RFPS', 'NFT', 'NFTS', 'DEFI', 'FTE', 'FTES', 'KPI', 'KPIS', 'Q', 'TB', 'GB', 'MB', 'PM', 'AM', 'UTC', 'PST', 'EST', 'CET', 'AOE', 'EVM', 'L1', 'L2', 'MVP', 'SDK', 'CLI', 'OSS', 'ETA', 'TBD', 'FAQ', 'USA', 'UK', 'EU', 'US']);

interface Stated { value: number; money: boolean }

/** Every number the text states, each with whether it reads as money: a currency
 *  symbol or code beside it, or a k/m/b scale. Thousands may be separated by
 *  commas, spaces, apostrophes ("$10’000") or dots ("€50.000"); a space- or
 *  dot-grouped number also yields its other readings, because "Q1 2026" and
 *  "1.500" are ambiguous. */
export function statedNumbers(text: string): Stated[] {
  const t = collapse(text);
  const out: Stated[] = [];
  const re = /(\d{1,3}(?:,\d{3}(?!\d))+(?:\.\d+)?|\d{1,3}(?:['’]\d{3}(?!\d))+|\d{1,3}(?: \d{3}(?!\d))+|\d{1,3}(?:\.\d{3}(?!\d))+(?:,\d+)?|\d+(?:\.\d+)?)(?:\s?(k|thousand|mm|mn|m|million|bn|b|billion)(?![a-z]))?/gi;
  for (const hit of t.matchAll(re)) {
    const raw = hit[1];
    const start = hit.index ?? 0, end = start + hit[0].length;
    const scale = hit[2] ? SCALE[hit[2].toLowerCase()] ?? 1 : 1;
    const before = t.slice(Math.max(0, start - 5), start), after = t.slice(end, end + 7);
    const money = scale !== 1
      || /(?:[$€£¥]|US\$|\b(?:USD|EUR|GBP|USDC|USDT|DAI))\s?$/i.test(before)
      // "25.- €" (Swiss), "2,000 xDAI", "1,000 cUSD": tickers may start lower-case.
      || /^(?:\.-)?\s?(?:[€£$]|US\$)/.test(after) || /^\s?(?:usd|eur|gbp|usdc|usdt|dai|eth|btc|dollars?|euros?|pounds?)\b/i.test(after)
      // A capitalised code reads as money unless it is an ordinary capitalised word ("10 AI projects").
      || (/^\s?[a-z]?[A-Z]{2,6}\b/.test(after) && !NOT_CURRENCY.has((/^\s?([a-z]?[A-Z]{2,6})\b/.exec(after)?.[1] ?? '').toUpperCase()));
    const readings = new Set<number>();
    if (raw.includes(',') && !/^\d{1,3}(?:\.\d{3})+,\d+$/.test(raw)) readings.add(Number(raw.replace(/,/g, '')));
    else if (/['’]/.test(raw)) readings.add(Number(raw.replace(/['’]/g, '')));
    else if (raw.includes(' ')) { readings.add(Number(raw.replace(/ /g, ''))); for (const part of raw.split(' ')) readings.add(Number(part)); }
    else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) { readings.add(Number(raw.replace(/\./g, '').replace(',', '.'))); readings.add(Number(raw.replace(/,\d+$/, ''))); }
    else readings.add(Number(raw));
    for (const v of readings) if (Number.isFinite(v)) out.push({ value: v * scale, money });
  }
  return out;
}

/** An amount is grounded when the text states that number (after scaling). Small
 *  and year-like numbers must read as money: otherwise "web3" grounds 3 and a
 *  "2026 round" grounds 2026 (PR #98 review). */
export function amountMentioned(n: number, text: string): boolean {
  if (!Number.isFinite(n) || n <= 0) return false;
  const needsMoney = n < 100 || (Number.isInteger(n) && n >= 1900 && n <= 2100);
  return statedNumbers(text).some(v => Math.abs(v.value - n) <= Math.max(0.5, n * 1e-9) && (!needsMoney || v.money));
}

const SYMBOL_CURRENCY: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };

/** Upper-cased currency/token code, accepted only when the text names it or uses
 *  its symbol on an amount. "$" counts only beside a number ("$OP" is a ticker),
 *  and a token code must appear in capitals ("near" is not NEAR). */
export function currencyMentioned(code: string, text: string): string | null {
  // "$AURORA" and "$BAL" are token tickers written with a dollar sign, not dollars.
  const raw = code.trim().toUpperCase().replace(/^US\$$/, 'USD').replace(/^\$(?=[A-Z])/, '');
  const fromSymbol = SYMBOL_CURRENCY[raw];
  const iso = fromSymbol ?? raw;
  if (!/^[A-Z0-9.]{2,12}$/.test(iso)) return null;
  const symbol = fromSymbol ? raw : Object.entries(SYMBOL_CURRENCY).find(([, v]) => v === iso)?.[0];
  if (symbol) {
    const s = symbol.replace(/[$]/g, '\\$&');
    if (new RegExp(`${s}\\s?\\d|\\d(?:\\.-)?\\s?${s}`).test(text)) return iso;
  }
  const escaped = iso.replace(/\./g, '\\.');
  if (iso === 'USD' && /\bUS\$|\bdollars?\b/i.test(text)) return iso;
  if (iso === 'EUR' && /\d\s?euros?\b/i.test(text)) return iso;
  // Major coins are written in lower case beside an amount ("2 eth").
  if ((iso === 'ETH' || iso === 'BTC') && new RegExp(`\\d\\s?${iso}\\b`, 'i').test(text)) return iso;
  if (FIAT.has(iso)) return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(text) ? iso : null;
  // A token ticker must be written as one: two or more capitals in the occurrence ("xDAI", "NEAR"),
  // so the word "near" never grounds NEAR. The text's own casing is returned ("xDAI", not "XDAI").
  for (const hit of text.matchAll(new RegExp(`(?<![A-Za-z0-9])\\$?(${escaped})(?![A-Za-z0-9])`, 'gi'))) {
    if ((hit[1].match(/[A-Z]/g) ?? []).length >= 2) return hit[1];
  }
  return null;
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

export interface BriefFields { deadline: string | null; program: string | null; amountMin: number | null; amountMax: number | null; currency: string | null; applyUrl: string | null }
export interface LegacyRow { deadline: Date | string | null; program: string | null; amount_min: string | number | null; amount_max: string | number | null; currency: string | null; apply_url: string | null }

/** The brief row's fields when the native pipeline takes over a row the legacy
 *  classifier filled. Native grounded values win; a legacy value is offered only
 *  where the native one is missing, and only if it grounds in the CURRENT text
 *  the same way (PR #98 review: a blind coalesce kept ungrounded legacy deadlines,
 *  silently filtering items out of the brief). A legacy deadline must also still
 *  be in the future, so it can never close a live call. Amount and currency move
 *  together so they never disagree. */
export function briefFields(native: BriefFields, legacy: LegacyRow | null, text: string, title: string, postedYear: number | null, now = Date.now()): BriefFields {
  if (!legacy) return native;
  const iso = legacy.deadline ? new Date(legacy.deadline).toISOString().slice(0, 10) : null;
  const legacyDeadline = iso && Date.parse(iso) + 86400000 > now && dateMentioned(iso, text, postedYear) ? iso : null;
  const num = (v: string | number | null) => (v == null ? null : Number(v));
  const lmin = num(legacy.amount_min), lmax = num(legacy.amount_max);
  const gmin = lmin != null && amountMentioned(lmin, text) ? lmin : null;
  const gmax = lmax != null && amountMentioned(lmax, text) ? lmax : null;
  const nativeHasAmount = native.amountMin != null || native.amountMax != null;
  const legacyAmount = !nativeHasAmount && (gmin != null || gmax != null);
  return {
    deadline: native.deadline ?? legacyDeadline,
    program: native.program ?? (legacy.program ? programMentioned(legacy.program, text, title) : null),
    amountMin: nativeHasAmount ? native.amountMin : legacyAmount ? gmin : null,
    amountMax: nativeHasAmount ? native.amountMax : legacyAmount ? gmax : null,
    currency: nativeHasAmount ? native.currency : legacyAmount && legacy.currency ? currencyMentioned(legacy.currency, text) : null,
    applyUrl: native.applyUrl ?? (legacy.apply_url && text.includes(legacy.apply_url) ? legacy.apply_url : null),
  };
}
