'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Forum } from '@/types';
import { getForums, saveForums, addForum as addForumToStorage, removeForum as removeForumFromStorage, toggleForum as toggleForumInStorage } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

export function useForums() {
  const { user, authenticated, ready } = usePrivy();
  const [forums, setForums] = useState<Forum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  const privyDid = user?.id;

  // Load forums on mount or auth change
  useEffect(() => {
    if (!ready) return;

    async function loadForums() {
      setIsLoading(true);
      
      if (authenticated && privyDid) {
        // Try to load from database
        try {
          const res = await fetch('/api/user/forums', {
            headers: { 'x-privy-did': privyDid },
          });
          
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.forums) && data.forums.length > 0) {
              setForums(data.forums);
              // Also save to localStorage as backup
              saveForums(data.forums);
              setIsLoading(false);
              initialLoadDone.current = true;
              return;
            }
          }
        } catch (error) {
          console.error('Failed to load forums from database:', error);
        }
        
        // If database is empty or failed, check localStorage and migrate
        const localForums = getForums();
        if (localForums.length > 0) {
          setForums(localForums);
          // Migrate localStorage forums to database
          try {
            await fetch('/api/user/forums', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-privy-did': privyDid,
              },
              body: JSON.stringify({ forums: localForums }),
            });
          } catch (error) {
            console.error('Failed to migrate forums to database:', error);
          }
        }
      } else {
        // Not authenticated, use localStorage
        setForums(getForums());
      }
      
      setIsLoading(false);
      initialLoadDone.current = true;
    }

    loadForums();
  }, [ready, authenticated, privyDid]);

  // Debounced sync to database
  const syncToDatabase = useCallback((newForums: Forum[]) => {
    if (!authenticated || !privyDid) return;
    
    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    // Debounce sync by 1 second
    syncTimeoutRef.current = setTimeout(async () => {
      setIsSyncing(true);
      try {
        await fetch('/api/user/forums', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-privy-did': privyDid,
          },
          body: JSON.stringify({ forums: newForums }),
        });
      } catch (error) {
        console.error('Failed to sync forums to database:', error);
      } finally {
        setIsSyncing(false);
      }
    }, 1000);
  }, [authenticated, privyDid]);

  const addForum = useCallback((forum: Omit<Forum, 'id' | 'createdAt'>) => {
    const newForum: Forum = {
      ...forum,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    
    setForums(prev => {
      const updated = [...prev, newForum];
      saveForums(updated); // Always save to localStorage as backup
      syncToDatabase(updated);
      return updated;
    });
    
    return newForum;
  }, [syncToDatabase]);

  const removeForum = useCallback((id: string) => {
    setForums(prev => {
      const updated = prev.filter(f => f.id !== id);
      saveForums(updated);
      syncToDatabase(updated);
      return updated;
    });
    return true;
  }, [syncToDatabase]);

  const toggleForum = useCallback((id: string) => {
    let updatedForum: Forum | null = null;
    
    setForums(prev => {
      const updated = prev.map(f => {
        if (f.id === id) {
          updatedForum = { ...f, isEnabled: !f.isEnabled };
          return updatedForum;
        }
        return f;
      });
      saveForums(updated);
      syncToDatabase(updated);
      return updated;
    });
    
    return updatedForum;
  }, [syncToDatabase]);

  const updateForum = useCallback((id: string, updates: Partial<Forum>) => {
    setForums(prev => {
      const updated = prev.map(f => f.id === id ? { ...f, ...updates } : f);
      saveForums(updated);
      syncToDatabase(updated);
      return updated;
    });
  }, [syncToDatabase]);

  const importForums = useCallback((newForums: Forum[], replace = false) => {
    setForums(prev => {
      let updated: Forum[];
      if (replace) {
        updated = newForums;
      } else {
        // Merge: add forums that don't already exist (by URL)
        const existingUrls = new Set(prev.map(f => f.discourseForum.url));
        const toAdd = newForums.filter(f => !existingUrls.has(f.discourseForum.url));
        updated = [...prev, ...toAdd];
      }
      saveForums(updated);
      syncToDatabase(updated);
      return updated;
    });
  }, [syncToDatabase]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Memoize derived state
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
    isSyncing,
  };
}
