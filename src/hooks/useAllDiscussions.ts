'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DiscussionTopic, DateRangeFilter, DateFilterMode, SortOption } from '@/types';

interface AllDiscussionsMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  cachedForumCount: number;
}

interface AllDiscussionsFilters {
  searchQuery: string;
  category: string | null;
  dateRange: DateRangeFilter;
  dateMode: DateFilterMode;
  sort: SortOption;
  keyword: string | null;
  forum: string | null;
}

interface AllDiscussionsTopic extends DiscussionTopic {
  isFollowing: boolean;
  category: string;
  forumName: string;
}

interface UseAllDiscussionsResult {
  discussions: AllDiscussionsTopic[];
  isLoading: boolean;
  meta: AllDiscussionsMeta | null;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  hasMore: boolean;
}

export function useAllDiscussions(
  enabled: boolean,
  filters: AllDiscussionsFilters,
  forumUrls: string[],
): UseAllDiscussionsResult {
  const [discussions, setDiscussions] = useState<AllDiscussionsTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [meta, setMeta] = useState<AllDiscussionsMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [refreshCount, setRefreshCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const prevFiltersKey = useRef('');

  const filtersKey = JSON.stringify(filters);

  const doFetch = useCallback(async (pageNum: number, append: boolean, signal: AbortSignal) => {
    try {
      const params = new URLSearchParams();
      if (filters.searchQuery) params.set('q', filters.searchQuery);
      if (filters.category) params.set('category', filters.category);
      params.set('dateRange', filters.dateRange);
      params.set('dateMode', filters.dateMode);
      params.set('sort', filters.sort);
      params.set('page', String(pageNum));
      params.set('limit', '40');
      if (filters.keyword) params.set('keyword', filters.keyword);
      if (filters.forum) params.set('forum', filters.forum);
      if (forumUrls.length > 0) params.set('forumUrls', forumUrls.join(','));

      const res = await fetch(`/api/discussions?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Failed to fetch discussions: ${res.status}`);

      const data = await res.json();
      if (signal.aborted) return;

      if (append) {
        setDiscussions(prev => [...prev, ...data.topics]);
      } else {
        setDiscussions(data.topics);
      }
      setMeta(data.meta);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to fetch discussions');
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [filters, forumUrls]);

  // Stable ref for doFetch so the effect doesn't re-trigger on filter changes
  // (filtersKey already handles that)
  const doFetchRef = useRef(doFetch);
  doFetchRef.current = doFetch;

  // Main effect: handles both filter changes and page changes
  useEffect(() => {
    if (!enabled) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const filtersChanged = prevFiltersKey.current !== filtersKey;
    prevFiltersKey.current = filtersKey;

    if (filtersChanged && page !== 1) {
      // Filters changed while on a later page — reset to page 1
      // This will re-trigger this effect with page=1
      setPage(1);
      setDiscussions([]);
      setMeta(null);
      return;
    }

    if (filtersChanged) {
      setDiscussions([]);
      setMeta(null);
    }

    setIsLoading(true);
    setError(null);
    doFetchRef.current(page, page > 1 && !filtersChanged, controller.signal);

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filtersKey, page, refreshCount]);

  const loadMore = useCallback(() => {
    if (meta && page < meta.totalPages && !isLoading) {
      setPage(p => p + 1);
    }
  }, [meta, page, isLoading]);

  const refresh = useCallback(() => {
    setPage(1);
    setDiscussions([]);
    setMeta(null);
    prevFiltersKey.current = '';
    setRefreshCount(c => c + 1);
  }, []);

  const hasMore = meta ? page < meta.totalPages : false;

  return { discussions, isLoading, meta, error, loadMore, refresh, hasMore };
}
