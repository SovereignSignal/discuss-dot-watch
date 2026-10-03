import type { DirectoryItem } from '@/types/delegates';

/**
 * Directory pages are not a stable snapshot. A user can move across a page
 * boundary between requests and appear twice in one refresh. Keep the newest
 * occurrence for each exact Discourse username while preserving first-seen
 * ordering so one bulk INSERT never contains duplicate conflict keys.
 */
export function dedupeDirectoryItems(items: DirectoryItem[]): DirectoryItem[] {
  const byUsername = new Map<string, DirectoryItem>();
  for (const item of items) {
    if (!item.username) continue;
    byUsername.set(item.username, item);
  }
  return [...byUsername.values()];
}
