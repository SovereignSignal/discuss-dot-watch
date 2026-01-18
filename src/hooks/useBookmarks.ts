'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import { Bookmark } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const BOOKMARKS_KEY = 'gov-forum-watcher-bookmarks';

const emptySubscribe = () => () => {};
const getServerSnapshot = (): Bookmark[] => [];

function getClientSnapshot(): Bookmark[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(BOOKMARKS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function useBookmarks() {
  const initialBookmarks = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);

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
      id: uuidv4(),
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
