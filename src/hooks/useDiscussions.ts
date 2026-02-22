'use client';

import { useState, useCallback, useRef } from 'react';
import { Forum, DiscussionTopic } from '@/types';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export interface ForumLoadingState {
  forumId: string;
  forumName: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
  isDefunct?: boolean; // Forum has shut down or moved
  retryCount?: number; // Number of retries needed
}

interface UseDiscussionsResult {
  discussions: DiscussionTopic[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  forumStates: ForumLoadingState[];
  refresh: () => Promise<void>;
}

export function useDiscussions(forums: Forum[]): UseDiscussionsResult {
  const [discussions, setDiscussions] = useState<DiscussionTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [forumStates, setForumStates] = useState<ForumLoadingState[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoize enabled forums to prevent unnecessary re-fetches
  // Only changes when IDs or enabled states actually change
  const forumsRef = useRef(forums);
  forumsRef.current = forums;

  const fetchDiscussions = useCallback(async () => {
    // Create a snapshot of enabled forums at fetch start to prevent race conditions
    // if forums change during the async operation
    const enabledForums = [...forumsRef.current.filter(f => f.isEnabled)];
    if (enabledForums.length === 0) {
      setDiscussions([]);
      setForumStates([]);
      return;
    }

    // Separate Discourse forums from external sources
    const EXTERNAL_SOURCE_TYPES = new Set(['ea-forum', 'lesswrong', 'github', 'hackernews', 'snapshot']);
    const discourseForums = enabledForums.filter(f => !f.sourceType || !EXTERNAL_SOURCE_TYPES.has(f.sourceType));
    const externalForums = enabledForums.filter(f => f.sourceType && EXTERNAL_SOURCE_TYPES.has(f.sourceType));

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError(null);
    
    const initialStates: ForumLoadingState[] = enabledForums.map(f => ({
      forumId: f.id,
      forumName: f.name,
      status: 'loading',
    }));
    setForumStates(initialStates);

    try {
      // Fetch Discourse forums
      const discourseResults = await Promise.allSettled(
        discourseForums.map(async (forum) => {
          const params = new URLSearchParams({
            forumUrl: forum.discourseForum.url,
            protocol: forum.cname,
            logoUrl: forum.logoUrl || '',
          });
          if (forum.discourseForum.categoryId) {
            params.set('categoryId', forum.discourseForum.categoryId.toString());
          }

          try {
            const { data, retryCount } = await fetchWithRetry<{ topics: DiscussionTopic[] }>(
              `/api/discourse?${params.toString()}`,
              { signal, maxRetries: 2, baseDelay: 1000 }
            );

            if (!signal.aborted) {
              setForumStates(prev => prev.map(s =>
                s.forumId === forum.id ? { ...s, status: 'success', retryCount } : s
              ));
            }

            return data.topics;
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              throw err;
            }
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            const isDefunct = errorMsg.includes('shut down') ||
                              errorMsg.includes('redirects') ||
                              errorMsg.includes('not JSON');
            if (!signal.aborted) {
              setForumStates(prev => prev.map(s =>
                s.forumId === forum.id ? { ...s, status: 'error', error: errorMsg, isDefunct } : s
              ));
            }
            throw new Error(`${forum.name}: ${errorMsg}`);
          }
        })
      );

      const allTopics: DiscussionTopic[] = [];
      const errors: string[] = [];

      discourseResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allTopics.push(...result.value);
        } else {
          errors.push(`${discourseForums[index].name}: ${result.reason.message}`);
        }
      });

      // Fetch external sources only if user has enabled any
      if (externalForums.length > 0) {
        try {
          const sourceIds = externalForums.map(f => f.cname).join(',');
          const externalRes = await fetch(`/api/external-sources?sources=${sourceIds}`, { signal });
          if (externalRes.ok) {
            const externalData = await externalRes.json();
            if (externalData.topics && Array.isArray(externalData.topics)) {
              allTopics.push(...externalData.topics);
            }
            // Mark external forum states as success
            if (!signal.aborted) {
              setForumStates(prev => prev.map(s => {
                const ext = externalForums.find(f => f.id === s.forumId);
                return ext ? { ...s, status: 'success' } : s;
              }));
            }
          }
        } catch (extErr) {
          if (!(extErr instanceof Error && extErr.name === 'AbortError')) {
            console.warn('Failed to fetch external sources:', extErr);
            // Mark external forum states as error
            if (!signal.aborted) {
              setForumStates(prev => prev.map(s => {
                const ext = externalForums.find(f => f.id === s.forumId);
                return ext ? { ...s, status: 'error', error: 'Failed to fetch' } : s;
              }));
            }
          }
        }
      }

      allTopics.sort((a, b) => new Date(b.bumpedAt).getTime() - new Date(a.bumpedAt).getTime());

      // Debug: log external source topic integration
      const externalTopicCount = allTopics.filter(t => t.sourceType && t.sourceType !== 'discourse').length;
      const protocols = new Map<string, number>();
      allTopics.forEach(t => protocols.set(t.protocol, (protocols.get(t.protocol) || 0) + 1));
      console.log(`[useDiscussions] Total topics: ${allTopics.length}, external: ${externalTopicCount}, aborted: ${signal.aborted}, protocols:`, Object.fromEntries(protocols));

      // Only update state if request wasn't aborted
      if (!signal.aborted) {
        setDiscussions(allTopics);
        setLastUpdated(new Date());

        const totalForums = discourseForums.length + externalForums.length;
        if (errors.length > 0 && errors.length < totalForums) {
          setError(`Some forums failed: ${errors.join(', ')}`);
        } else if (errors.length === totalForums) {
          setError('All forums failed to load. Please check your connections.');
        }
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to fetch discussions');
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []); // No dependencies - uses ref for forums

  return {
    discussions,
    isLoading,
    error,
    lastUpdated,
    forumStates,
    refresh: fetchDiscussions,
  };
}
