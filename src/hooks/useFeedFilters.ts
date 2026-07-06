'use client';

import { useState } from 'react';
import { DateRangeFilter, DateFilterMode, SortOption } from '@/types';

/**
 * Feed filter state, owned by the page so it survives Your/All Forums
 * toggles and view switches. (Previously each conditionally-mounted
 * DiscussionFeed instance owned its own copy, so every toggle wiped
 * category, date range, sort, and forum selection.)
 *
 * `selectedForum` is the forum's NORMALIZED URL (lowercase, no trailing
 * slash) in both modes, so the selection stays meaningful across the
 * Your/All toggle and the command menu can set it directly.
 */
export function useFeedFilters() {
  const [dateRange, setDateRange] = useState<DateRangeFilter>('week');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('created');
  const [selectedForum, setSelectedForum] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  return {
    dateRange, setDateRange,
    dateFilterMode, setDateFilterMode,
    selectedForum, setSelectedForum,
    selectedCategory, setSelectedCategory,
    sortBy, setSortBy,
  };
}

export type FeedFiltersController = ReturnType<typeof useFeedFilters>;

/** Normalize a forum URL the way selectedForum stores it. */
export function normalizeForumUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}
