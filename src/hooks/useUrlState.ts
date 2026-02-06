'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { DateRangeFilter, SortOption } from '@/types';

interface UrlState {
  search: string;
  dateRange: DateRangeFilter;
  sortBy: SortOption;
  forumId: string | null;
  view: 'feed' | 'projects' | 'saved' | 'settings';
}

const DEFAULT_STATE: UrlState = {
  search: '',
  dateRange: 'today',
  sortBy: 'recent',
  forumId: null,
  view: 'feed',
};

export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse URL params - computed directly from searchParams
  const state = useMemo((): UrlState => {
    return {
      search: searchParams.get('q') || DEFAULT_STATE.search,
      dateRange: (searchParams.get('date') as DateRangeFilter) || DEFAULT_STATE.dateRange,
      sortBy: (searchParams.get('sort') as SortOption) || DEFAULT_STATE.sortBy,
      forumId: searchParams.get('forum') || DEFAULT_STATE.forumId,
      view: (searchParams.get('view') as UrlState['view']) || DEFAULT_STATE.view,
    };
  }, [searchParams]);

  // Track if we're on client side
  const [isHydrated] = useState(() => typeof window !== 'undefined');

  // Update URL when state changes
  const updateUrl = useCallback(
    (newState: Partial<UrlState>) => {
      const merged = { ...state, ...newState };
      const params = new URLSearchParams();

      if (merged.search) params.set('q', merged.search);
      if (merged.dateRange !== 'today') params.set('date', merged.dateRange);
      if (merged.sortBy !== 'recent') params.set('sort', merged.sortBy);
      if (merged.forumId) params.set('forum', merged.forumId);
      if (merged.view !== 'feed') params.set('view', merged.view);

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

      // Use replace to avoid polluting history with every filter change
      router.replace(newUrl, { scroll: false });
    },
    [state, pathname, router]
  );

  return {
    ...state,
    isHydrated,
    setSearch: (search: string) => updateUrl({ search }),
    setDateRange: (dateRange: DateRangeFilter) => updateUrl({ dateRange }),
    setSortBy: (sortBy: SortOption) => updateUrl({ sortBy }),
    setForumId: (forumId: string | null) => updateUrl({ forumId }),
    setView: (view: UrlState['view']) => updateUrl({ view }),
    resetFilters: () => updateUrl(DEFAULT_STATE),
  };
}
