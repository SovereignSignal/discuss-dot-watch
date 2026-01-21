import { Forum, KeywordAlert, Bookmark } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const FORUMS_KEY = 'gov-forum-watcher-forums';
const ALERTS_KEY = 'gov-forum-watcher-alerts';
const BOOKMARKS_KEY = 'gov-forum-watcher-bookmarks';

// Zod schemas for data validation
const ForumCategoryIdSchema = z.enum([
  'l2-protocols',
  'l1-protocols',
  'defi-lending',
  'defi-dex',
  'defi-staking',
  'defi-other',
  'major-daos',
  'infrastructure',
  'privacy',
  'ai-crypto',
  'ai-developer',
  'governance-meta',
  'custom',
]);

const ForumSchema = z.object({
  id: z.string().min(1),
  cname: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  token: z.string().max(50).optional(),
  category: ForumCategoryIdSchema.optional(),
  discourseForum: z.object({
    url: z.string().url(),
    categoryId: z.number().int().positive().optional(),
  }),
  isEnabled: z.boolean(),
  createdAt: z.string(),
});

const KeywordAlertSchema = z.object({
  id: z.string().min(1),
  keyword: z.string().min(1).max(100),
  createdAt: z.string(),
  isEnabled: z.boolean(),
});

const BookmarkSchema = z.object({
  id: z.string().min(1),
  topicRefId: z.string().min(1),
  topicTitle: z.string().min(1).max(500),
  topicUrl: z.string().url(),
  protocol: z.string().min(1).max(200),
  createdAt: z.string(),
});

export function getForums(): Forum[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(FORUMS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Validate and filter out invalid entries
    const validated = z.array(ForumSchema).safeParse(parsed);
    if (validated.success) {
      return validated.data as Forum[];
    }
    // If schema validation fails, try to salvage valid items
    console.warn('Forum data validation failed, attempting recovery');
    return Array.isArray(parsed) ? parsed.filter(item => ForumSchema.safeParse(item).success) : [];
  } catch (error) {
    console.error('Failed to parse forums from storage:', error);
    return [];
  }
}

export function saveForums(forums: Forum[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FORUMS_KEY, JSON.stringify(forums));
}

export function addForum(forum: Omit<Forum, 'id' | 'createdAt'>): Forum {
  const forums = getForums();
  const newForum: Forum = {
    ...forum,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  forums.push(newForum);
  saveForums(forums);
  return newForum;
}

export function updateForum(id: string, updates: Partial<Forum>): Forum | null {
  const forums = getForums();
  const index = forums.findIndex(f => f.id === id);
  if (index === -1) return null;
  forums[index] = { ...forums[index], ...updates };
  saveForums(forums);
  return forums[index];
}

export function removeForum(id: string): boolean {
  const forums = getForums();
  const filtered = forums.filter(f => f.id !== id);
  if (filtered.length === forums.length) return false;
  saveForums(filtered);
  return true;
}

export function toggleForum(id: string): Forum | null {
  const forums = getForums();
  const forum = forums.find(f => f.id === id);
  if (!forum) return null;
  return updateForum(id, { isEnabled: !forum.isEnabled });
}

export function getAlerts(): KeywordAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(ALERTS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const validated = z.array(KeywordAlertSchema).safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    console.warn('Alert data validation failed, attempting recovery');
    return Array.isArray(parsed) ? parsed.filter(item => KeywordAlertSchema.safeParse(item).success) : [];
  } catch (error) {
    console.error('Failed to parse alerts from storage:', error);
    return [];
  }
}

export function saveAlerts(alerts: KeywordAlert[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function addAlert(keyword: string): KeywordAlert {
  const alerts = getAlerts();
  const newAlert: KeywordAlert = {
    id: uuidv4(),
    keyword,
    createdAt: new Date().toISOString(),
    isEnabled: true,
  };
  alerts.push(newAlert);
  saveAlerts(alerts);
  return newAlert;
}

export function removeAlert(id: string): boolean {
  const alerts = getAlerts();
  const filtered = alerts.filter(a => a.id !== id);
  if (filtered.length === alerts.length) return false;
  saveAlerts(filtered);
  return true;
}

export function toggleAlert(id: string): KeywordAlert | null {
  const alerts = getAlerts();
  const index = alerts.findIndex(a => a.id === id);
  if (index === -1) return null;
  alerts[index] = { ...alerts[index], isEnabled: !alerts[index].isEnabled };
  saveAlerts(alerts);
  return alerts[index];
}

export function getBookmarks(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const validated = z.array(BookmarkSchema).safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    console.warn('Bookmark data validation failed, attempting recovery');
    return Array.isArray(parsed) ? parsed.filter(item => BookmarkSchema.safeParse(item).success) : [];
  } catch (error) {
    console.error('Failed to parse bookmarks from storage:', error);
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

// Export schemas for use in other modules if needed
export { BookmarkSchema, ForumSchema, KeywordAlertSchema };
