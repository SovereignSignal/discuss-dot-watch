'use client';

import { useState, useCallback } from 'react';
import { Bookmark } from '@/types';

const BOOKMARKS_KEY = 'gov-forum-watcher-bookmarks';

function getStoredBookmarks(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKMARKS_KEY);
    return stored ? JSON.parse(stored) : [];
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
    protocol: string;
  }) => {
    const exists = bookmarks.some(b => b.topicRefId === topic.refId);
    if (exists) return;

    const newBookmark: Bookmark = {
      id: crypto.randomUUID(),
      topicRefId: topic.refId,
      topicTitle: topic.title,
      topicUrl: topic.forumUrl,
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
