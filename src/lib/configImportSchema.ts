/**
 * Validation for user-supplied config export/import files (ConfigExportImport.tsx).
 *
 * The importer previously only checked `version`/`exportedAt`/array-ness on the
 * top-level object, then accessed fields like `forum.discourseForum.url`
 * directly — a hand-edited or corrupted file with e.g. `forums: [{}]` throws
 * a TypeError inside a React state updater and drops the user into the app's
 * ErrorBoundary. These schemas validate each item's shape before it's used.
 */
import { z } from 'zod';
import type { Forum, KeywordAlert, Bookmark } from '@/types';

// Typed against the app's actual interfaces (z.ZodType<T>) rather than
// z.infer'd, so a valid item round-trips as a real Forum/KeywordAlert/Bookmark
// (e.g. `category` stays whatever string the file had — ForumCategoryId is a
// closed union but unknown values are harmless downstream, same as before
// this validation existed) instead of a structurally-looser inferred shape.
const ForumSchema = z.object({
  id: z.string(),
  cname: z.string(),
  name: z.string(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  token: z.string().optional(),
  category: z.string().optional(),
  sourceType: z.string().optional(),
  discourseForum: z.object({
    url: z.string().min(1),
    categoryId: z.number().optional(),
  }),
  isEnabled: z.boolean(),
  createdAt: z.string(),
}).passthrough() as unknown as z.ZodType<Forum>;

const KeywordAlertSchema = z.object({
  id: z.string(),
  keyword: z.string().min(1),
  createdAt: z.string(),
  isEnabled: z.boolean(),
}).passthrough() as unknown as z.ZodType<KeywordAlert>;

const BookmarkSchema = z.object({
  id: z.string(),
  topicRefId: z.string(),
  topicTitle: z.string(),
  topicUrl: z.string(),
  protocol: z.string(),
  createdAt: z.string(),
  folder: z.string().nullable().optional(),
}).passthrough() as unknown as z.ZodType<Bookmark>;

export interface ValidatedExportData {
  version: 1;
  exportedAt: string;
  forums?: Forum[];
  alerts?: KeywordAlert[];
  bookmarks?: Bookmark[];
}

/**
 * Parse and validate an import file. Individual malformed items are dropped
 * (with a warning) rather than failing the whole import, since a partially
 * corrupted export shouldn't block restoring the valid items in it.
 */
export function parseExportData(raw: unknown): { data: ValidatedExportData; droppedCount: number } {
  const topLevelResult = z.object({
    version: z.literal(1),
    exportedAt: z.string(),
    forums: z.array(z.unknown()).optional(),
    alerts: z.array(z.unknown()).optional(),
    bookmarks: z.array(z.unknown()).optional(),
  }).safeParse(raw);

  if (!topLevelResult.success) {
    throw new Error('Invalid configuration file format');
  }
  const topLevel = topLevelResult.data;

  let droppedCount = 0;
  const filterValid = <T>(items: unknown[] | undefined, schema: z.ZodType<T>): T[] | undefined => {
    if (!items) return undefined;
    const valid: T[] = [];
    for (const item of items) {
      const result = schema.safeParse(item);
      if (result.success) {
        valid.push(result.data);
      } else {
        droppedCount++;
      }
    }
    return valid;
  };

  const data: ValidatedExportData = {
    version: topLevel.version,
    exportedAt: topLevel.exportedAt,
    forums: filterValid(topLevel.forums, ForumSchema),
    alerts: filterValid(topLevel.alerts, KeywordAlertSchema),
    bookmarks: filterValid(topLevel.bookmarks, BookmarkSchema),
  };

  return { data, droppedCount };
}
