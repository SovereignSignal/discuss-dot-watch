import { Forum, KeywordAlert, Bookmark } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const FORUMS_KEY = 'gov-forum-watcher-forums';
const ALERTS_KEY = 'gov-forum-watcher-alerts';
const BOOKMARKS_KEY = 'gov-forum-watcher-bookmarks';

// Storage quota monitoring
export interface StorageQuota {
  used: number;
  available: number;
  percentUsed: number;
  isNearLimit: boolean;
}

export interface StorageError {
  type: 'quota_exceeded' | 'parse_error' | 'validation_error' | 'unknown';
  message: string;
  recoveredItems?: number;
}

// Callback for storage events
type StorageErrorCallback = (error: StorageError) => void;
let storageErrorCallback: StorageErrorCallback | null = null;

export function setStorageErrorCallback(callback: StorageErrorCallback | null): void {
  storageErrorCallback = callback;
}

function notifyStorageError(error: StorageError): void {
  if (storageErrorCallback) {
    storageErrorCallback(error);
  }
}

// Estimate localStorage usage
export async function getStorageQuota(): Promise<StorageQuota> {
  if (typeof window === 'undefined') {
    return { used: 0, available: 5 * 1024 * 1024, percentUsed: 0, isNearLimit: false };
  }

  // Calculate localStorage usage
  let used = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
    }
  }

  // localStorage typically has 5-10MB limit, assume 5MB as safe default
  const available = 5 * 1024 * 1024;
  const percentUsed = (used / available) * 100;

  return {
    used,
    available,
    percentUsed,
    isNearLimit: percentUsed > 80,
  };
}

// Safe localStorage.setItem with quota handling
function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
      notifyStorageError({
        type: 'quota_exceeded',
        message: 'Storage is full. Consider exporting your data and clearing old items.',
      });
    } else {
      notifyStorageError({
        type: 'unknown',
        message: 'Failed to save data to storage.',
      });
    }
    return false;
  }
}

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
    const recovered = Array.isArray(parsed) ? parsed.filter(item => ForumSchema.safeParse(item).success) : [];
    notifyStorageError({
      type: 'validation_error',
      message: `Some forum data was corrupted. Recovered ${recovered.length} forums.`,
      recoveredItems: recovered.length,
    });
    return recovered;
  } catch (error) {
    console.error('Failed to parse forums from storage:', error);
    notifyStorageError({
      type: 'parse_error',
      message: 'Failed to read forum data. Your forums may need to be re-added.',
    });
    return [];
  }
}

export function saveForums(forums: Forum[]): boolean {
  if (typeof window === 'undefined') return false;
  return safeSetItem(FORUMS_KEY, JSON.stringify(forums));
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
    const recovered = Array.isArray(parsed) ? parsed.filter(item => KeywordAlertSchema.safeParse(item).success) : [];
    notifyStorageError({
      type: 'validation_error',
      message: `Some alert data was corrupted. Recovered ${recovered.length} alerts.`,
      recoveredItems: recovered.length,
    });
    return recovered;
  } catch (error) {
    console.error('Failed to parse alerts from storage:', error);
    notifyStorageError({
      type: 'parse_error',
      message: 'Failed to read alert data. Your alerts may need to be re-added.',
    });
    return [];
  }
}

export function saveAlerts(alerts: KeywordAlert[]): boolean {
  if (typeof window === 'undefined') return false;
  return safeSetItem(ALERTS_KEY, JSON.stringify(alerts));
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
    const recovered = Array.isArray(parsed) ? parsed.filter(item => BookmarkSchema.safeParse(item).success) : [];
    notifyStorageError({
      type: 'validation_error',
      message: `Some bookmark data was corrupted. Recovered ${recovered.length} bookmarks.`,
      recoveredItems: recovered.length,
    });
    return recovered;
  } catch (error) {
    console.error('Failed to parse bookmarks from storage:', error);
    notifyStorageError({
      type: 'parse_error',
      message: 'Failed to read bookmark data. Your bookmarks may need to be re-added.',
    });
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]): boolean {
  if (typeof window === 'undefined') return false;
  return safeSetItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

// Export schemas for use in other modules if needed
export { BookmarkSchema, ForumSchema, KeywordAlertSchema };
