/**
 * Shared helpers for the external-source clients (EA Forum, GitHub Discussions,
 * Lobsters, Hacker News, Snapshot). These were copy-pasted verbatim into each
 * client; centralizing them keeps them from drifting.
 */

/** Deterministic 32-bit hash of a string → non-negative number (stable synthetic ids). */
export function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/** Truncate text to a maximum length, appending an ellipsis. */
export function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

/** Strip HTML tags and decode the common entities, collapsing whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
