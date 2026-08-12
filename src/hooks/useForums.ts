'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Forum } from '@/types';
import { getForums, saveForums } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

export function useForums() {
  const [forums, setForums] = useState<Forum[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setForums(getForums());
    setIsLoading(false);
  }, []);

  const commitForums = useCallback((updated: Forum[]): boolean => {
    if (!saveForums(updated)) return false;
    setForums(updated);
    return true;
  }, []);

  const addForum = useCallback((forum: Omit<Forum, 'id' | 'createdAt'>) => {
    const newForum: Forum = {
      ...forum,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    return commitForums([...forums, newForum]) ? newForum : null;
  }, [commitForums, forums]);

  const removeForum = useCallback((id: string) => {
    const updated = forums.filter(f => f.id !== id);
    return updated.length !== forums.length && commitForums(updated);
  }, [commitForums, forums]);

  const toggleForum = useCallback((id: string) => {
    const current = forums.find(f => f.id === id);
    if (!current) return null;
    const updatedForum = { ...current, isEnabled: !current.isEnabled };
    const updated = forums.map(f => f.id === id ? updatedForum : f);
    return commitForums(updated) ? updatedForum : null;
  }, [commitForums, forums]);

  const updateForum = useCallback((id: string, updates: Partial<Forum>) => {
    if (!forums.some(f => f.id === id)) return false;
    return commitForums(forums.map(f => f.id === id ? { ...f, ...updates } : f));
  }, [commitForums, forums]);

  const importForums = useCallback((newForums: Forum[], replace = false) => {
    if (replace) return commitForums(newForums);
    const existingUrls = new Set(forums.map(f => f.discourseForum.url));
    const toAdd = newForums.filter(f => f.discourseForum?.url && !existingUrls.has(f.discourseForum.url));
    return commitForums([...forums, ...toAdd]);
  }, [commitForums, forums]);

  const enabledForums = useMemo(() => (Array.isArray(forums) ? forums : []).filter(f => f.isEnabled), [forums]);

  return {
    forums,
    enabledForums,
    addForum,
    removeForum,
    toggleForum,
    updateForum,
    importForums,
    isLoading,
    isSyncing: false,
  };
}
