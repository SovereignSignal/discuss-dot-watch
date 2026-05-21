'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Bookmark } from '@/types';
import { getBookmarks, saveBookmarks as saveBookmarksToStorage } from '@/lib/storage';
import { useDataSync } from '@/components/DataSyncProvider';

const MIGRATION_KEY = 'discuss-watch-bookmarks-migrated-v1';

// Helper to create a slug from title
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

// Migrate old bookmarks that have base-domain-only URLs
function migrateBookmarks(bookmarks: Bookmark[]): Bookmark[] {
  if (typeof window === 'undefined') return bookmarks;

  // Check if already migrated
  if (localStorage.getItem(MIGRATION_KEY)) return bookmarks;

  let needsSave = false;
  const migrated = bookmarks.map(bookmark => {
    // Check if URL is missing the /t/ path (base domain only)
    if (!bookmark.topicUrl.includes('/t/')) {
      // Extract topic ID from refId (format: "protocol-topicId")
      const refParts = bookmark.topicRefId.split('-');
      const topicId = refParts[refParts.length - 1];

      if (topicId && !isNaN(Number(topicId))) {
        const slug = slugify(bookmark.topicTitle);
        needsSave = true;
        // Return a new object instead of mutating the original
        return {
          ...bookmark,
          topicUrl: `${bookmark.topicUrl}/t/${slug}/${topicId}`,
        };
      }
    }
    return bookmark;
  });

  // Mark as migrated
  localStorage.setItem(MIGRATION_KEY, 'true');

  // Save migrated bookmarks if any were changed
  if (needsSave) {
    saveBookmarksToStorage(migrated);
  }

  return migrated;
}

function getStoredBookmarks(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  // Use validated getter from storage, then run migration
  const bookmarks = getBookmarks();
  return migrateBookmarks(bookmarks);
}

export function useBookmarks() {
  // Use lazy initialization - this runs only on client after hydration
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getStoredBookmarks());
  const { serverData, syncBookmarks } = useDataSync();
  const hydratedRef = useRef(false);

  // Hydrate from server on first arrival of serverData (cross-device sync)
  useEffect(() => {
    if (!serverData || hydratedRef.current) return;
    hydratedRef.current = true;

    const local = bookmarks;
    const server: Bookmark[] = serverData.bookmarks.map((b) => ({
      id: b.id,
      topicRefId: b.topicRefId,
      topicTitle: b.topicTitle,
      topicUrl: b.topicUrl,
      protocol: b.protocol,
      folder: (b as Bookmark).folder ?? null,
      createdAt: b.createdAt,
    }));

    if (local.length === 0 && server.length > 0) {
      setBookmarks(server);
      saveBookmarksToStorage(server);
    } else if (local.length > 0 && server.length === 0) {
      syncBookmarks(local);
    } else if (local.length > 0 && server.length > 0) {
      const localRefs = new Set(local.map((b) => b.topicRefId));
      const merged = [...local, ...server.filter((b) => !localRefs.has(b.topicRefId))];
      if (merged.length !== local.length) {
        setBookmarks(merged);
        saveBookmarksToStorage(merged);
        syncBookmarks(merged);
      }
    }
  }, [serverData, bookmarks, syncBookmarks]);

  const persistBookmarks = useCallback((updated: Bookmark[]) => {
    saveBookmarksToStorage(updated);
    if (hydratedRef.current) {
      syncBookmarks(updated);
    }
  }, [syncBookmarks]);

  const addBookmark = useCallback((topic: {
    refId: string;
    title: string;
    forumUrl: string;
    slug: string;
    id: number;
    protocol: string;
    externalUrl?: string;
  }) => {
    setBookmarks(prev => {
      if (prev.some(b => b.topicRefId === topic.refId)) return prev;

      const fullTopicUrl = topic.externalUrl || `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        topicRefId: topic.refId,
        topicTitle: topic.title,
        topicUrl: fullTopicUrl,
        protocol: topic.protocol,
        createdAt: new Date().toISOString(),
      };
      const updated = [newBookmark, ...prev];
      persistBookmarks(updated);
      return updated;
    });
  }, [persistBookmarks]);

  const removeBookmark = useCallback((topicRefId: string) => {
    setBookmarks(prev => {
      const updated = prev.filter(b => b.topicRefId !== topicRefId);
      persistBookmarks(updated);
      return updated;
    });
  }, [persistBookmarks]);

  const setBookmarkFolder = useCallback((topicRefId: string, folder: string | null) => {
    setBookmarks(prev => {
      const sanitized = folder && folder.trim() ? folder.trim().slice(0, 100) : null;
      const updated = prev.map(b => b.topicRefId === topicRefId ? { ...b, folder: sanitized } : b);
      persistBookmarks(updated);
      return updated;
    });
  }, [persistBookmarks]);

  const bookmarkedRefIds = useMemo(
    () => new Set(bookmarks.map(b => b.topicRefId)),
    [bookmarks]
  );

  const isBookmarked = useCallback((topicRefId: string) => {
    return bookmarkedRefIds.has(topicRefId);
  }, [bookmarkedRefIds]);

  const importBookmarks = useCallback((newBookmarks: Bookmark[], replace = false) => {
    setBookmarks(prev => {
      if (replace) {
        persistBookmarks(newBookmarks);
        return newBookmarks;
      }
      const existingRefs = new Set(prev.map(b => b.topicRefId));
      const toAdd = newBookmarks.filter(b => !existingRefs.has(b.topicRefId));
      const updated = [...prev, ...toAdd];
      persistBookmarks(updated);
      return updated;
    });
  }, [persistBookmarks]);

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    setBookmarkFolder,
    isBookmarked,
    importBookmarks,
  };
}
