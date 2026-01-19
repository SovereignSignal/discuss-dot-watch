'use client';

import { useState, useCallback } from 'react';
import { Bookmark } from '@/types';

const BOOKMARKS_KEY = 'gov-forum-watcher-bookmarks';
const MIGRATION_KEY = 'gov-forum-watcher-bookmarks-migrated-v1';

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
        bookmark.topicUrl = `${bookmark.topicUrl}/t/${slug}/${topicId}`;
        needsSave = true;
      }
    }
    return bookmark;
  });
  
  // Mark as migrated
  localStorage.setItem(MIGRATION_KEY, 'true');
  
  // Save migrated bookmarks if any were changed
  if (needsSave) {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(migrated));
  }
  
  return migrated;
}

function getStoredBookmarks(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    const bookmarks = stored ? JSON.parse(stored) : [];
    return migrateBookmarks(bookmarks);
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => getStoredBookmarks());
  const [isHydrated, setIsHydrated] = useState(false);

  if (typeof window !== 'undefined' && !isHydrated) {
    setBookmarks(getStoredBookmarks());
    setIsHydrated(true);
  }

  const saveBookmarks = useCallback((newBookmarks: Bookmark[]) => {
    setBookmarks(newBookmarks);
    if (typeof window !== 'undefined') {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(newBookmarks));
    }
  }, []);

  const addBookmark = useCallback((topic: {
    refId: string;
    title: string;
    forumUrl: string;
    slug: string;
    id: number;
    protocol: string;
  }) => {
    const exists = bookmarks.some(b => b.topicRefId === topic.refId);
    if (exists) return;

    // Construct the full topic URL: {forumUrl}/t/{slug}/{id}
    const fullTopicUrl = `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;

    const newBookmark: Bookmark = {
      id: crypto.randomUUID(),
      topicRefId: topic.refId,
      topicTitle: topic.title,
      topicUrl: fullTopicUrl,
      protocol: topic.protocol,
      createdAt: new Date().toISOString(),
    };
    saveBookmarks([newBookmark, ...bookmarks]);
  }, [bookmarks, saveBookmarks]);

  const removeBookmark = useCallback((topicRefId: string) => {
    saveBookmarks(bookmarks.filter(b => b.topicRefId !== topicRefId));
  }, [bookmarks, saveBookmarks]);

  const isBookmarked = useCallback((topicRefId: string) => {
    return bookmarks.some(b => b.topicRefId === topicRefId);
  }, [bookmarks]);

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    isBookmarked,
  };
}
