'use client';

import { useState, useCallback, useMemo } from 'react';
import { Forum } from '@/types';
import { getForums, saveForums, addForum as addForumToStorage, removeForum as removeForumFromStorage, toggleForum as toggleForumInStorage } from '@/lib/storage';

export function useForums() {
  // Use lazy initialization - this runs only on client after hydration
  const [forums, setForums] = useState<Forum[]>(() => {
    // Only access localStorage on client side
    if (typeof window === 'undefined') return [];
    return getForums();
  });

  const addForum = useCallback((forum: Omit<Forum, 'id' | 'createdAt'>) => {
    const newForum = addForumToStorage(forum);
    setForums(prev => [...prev, newForum]);
    return newForum;
  }, []);

  const removeForum = useCallback((id: string) => {
    const success = removeForumFromStorage(id);
    if (success) {
      setForums(prev => prev.filter(f => f.id !== id));
    }
    return success;
  }, []);

  const toggleForum = useCallback((id: string) => {
    const updated = toggleForumInStorage(id);
    if (updated) {
      setForums(prev => prev.map(f => f.id === id ? updated : f));
    }
    return updated;
  }, []);

  const updateForum = useCallback((id: string, updates: Partial<Forum>) => {
    setForums(prev => {
      const updated = prev.map(f => f.id === id ? { ...f, ...updates } : f);
      saveForums(updated);
      return updated;
    });
  }, []);

  // Memoize derived state to prevent unnecessary recalculations
  const enabledForums = useMemo(() => forums.filter(f => f.isEnabled), [forums]);

  return {
    forums,
    enabledForums,
    addForum,
    removeForum,
    toggleForum,
    updateForum,
  };
}
