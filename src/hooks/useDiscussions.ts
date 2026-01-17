'use client';

import { useState, useCallback } from 'react';
import { Forum, DiscussionTopic } from '@/types';

interface UseDiscussionsResult {
  discussions: DiscussionTopic[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useDiscussions(forums: Forum[]): UseDiscussionsResult {
  const [discussions, setDiscussions] = useState<DiscussionTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDiscussions = useCallback(async () => {
    const enabledForums = forums.filter(f => f.isEnabled);
    if (enabledForums.length === 0) {
      setDiscussions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        enabledForums.map(async (forum) => {
          const params = new URLSearchParams({
            forumUrl: forum.discourseForum.url,
            protocol: forum.cname,
            logoUrl: forum.logoUrl || '',
          });
          if (forum.discourseForum.categoryId) {
            params.set('categoryId', forum.discourseForum.categoryId.toString());
          }

          const response = await fetch(`/api/discourse?${params.toString()}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch from ${forum.name}`);
          }
          const data = await response.json();
          return data.topics as DiscussionTopic[];
        })
      );

      const allTopics: DiscussionTopic[] = [];
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allTopics.push(...result.value);
        } else {
          errors.push(`${enabledForums[index].name}: ${result.reason.message}`);
        }
      });

      allTopics.sort((a, b) => new Date(b.bumpedAt).getTime() - new Date(a.bumpedAt).getTime());
      
      setDiscussions(allTopics);
      setLastUpdated(new Date());
      
      if (errors.length > 0) {
        setError(`Some forums failed to load: ${errors.join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch discussions');
    } finally {
      setIsLoading(false);
    }
  }, [forums]);

  return {
    discussions,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchDiscussions,
  };
}
