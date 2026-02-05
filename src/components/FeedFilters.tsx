'use client';

import { ArrowUpDown, Filter } from 'lucide-react';
import { DateRangeFilter, DateFilterMode, SortOption, Forum } from '@/types';

interface FeedFiltersProps {
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  dateFilterMode: DateFilterMode;
  onDateFilterModeChange: (mode: DateFilterMode) => void;
  selectedForumId: string | null;
  onForumFilterChange: (forumId: string | null) => void;
  forums: Forum[];
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  isDark?: boolean;
}

const DATE_RANGE_OPTIONS: { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'replies', label: 'Replies' },
  { value: 'views', label: 'Views' },
  { value: 'likes', label: 'Likes' },
];

export function FeedFilters({
  dateRange,
  onDateRangeChange,
  dateFilterMode,
  onDateFilterModeChange,
  selectedForumId,
  onForumFilterChange,
  forums,
  sortBy,
  onSortChange,
  isDark = true,
}: FeedFiltersProps) {
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textMuted = isDark ? '#52525b' : '#a1a1aa';
  const textSecondary = isDark ? '#a1a1aa' : '#71717a';
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const selectBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  return (
    <div 
      className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b text-[12px]"
      style={{ borderColor }}
    >
      {/* Date filter mode */}
      <div className="flex items-center gap-1 mr-1">
        <button
          onClick={() => onDateFilterModeChange('created')}
          className="px-2 py-1 rounded-md font-medium transition-colors"
          style={{
            backgroundColor: dateFilterMode === 'created' ? activeBg : 'transparent',
            color: dateFilterMode === 'created' ? textSecondary : textMuted
          }}
        >
          Created
        </button>
        <button
          onClick={() => onDateFilterModeChange('activity')}
          className="px-2 py-1 rounded-md font-medium transition-colors"
          style={{
            backgroundColor: dateFilterMode === 'activity' ? activeBg : 'transparent',
            color: dateFilterMode === 'activity' ? textSecondary : textMuted
          }}
        >
          Activity
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-4" style={{ backgroundColor: borderColor }} />

      {/* Date range */}
      <div className="flex items-center gap-1">
        {DATE_RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onDateRangeChange(option.value)}
            className="px-2 py-1 rounded-md font-medium transition-colors"
            style={{
              backgroundColor: dateRange === option.value ? activeBg : 'transparent',
              color: dateRange === option.value ? textSecondary : textMuted
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-4" style={{ backgroundColor: borderColor }} />

      {/* Forum filter */}
      {forums.length > 0 && (
        <select
          value={selectedForumId || ''}
          onChange={(e) => onForumFilterChange(e.target.value || null)}
          className="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
          style={{ 
            backgroundColor: selectedForumId ? activeBg : selectBg,
            color: textSecondary,
            border: 'none',
            fontSize: '12px'
          }}
        >
          <option value="">All forums</option>
          {forums.map((forum) => (
            <option key={forum.id} value={forum.id}>{forum.name}</option>
          ))}
        </select>
      )}

      {/* Sort - right aligned */}
      <div className="flex items-center gap-1 ml-auto">
        <ArrowUpDown className="w-3 h-3" style={{ color: textMuted }} />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
          style={{ 
            backgroundColor: selectBg,
            color: textSecondary,
            border: 'none',
            fontSize: '12px'
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
