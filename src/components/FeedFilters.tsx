'use client';

import { Calendar, Filter, ArrowUpDown, Clock, Sparkles } from 'lucide-react';
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
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'replies', label: 'Most Replies' },
  { value: 'views', label: 'Most Views' },
  { value: 'likes', label: 'Most Likes' },
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
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const bgColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const textMuted = isDark ? '#71717a' : '#a1a1aa';
  const textSecondary = isDark ? '#a1a1aa' : '#71717a';

  return (
    <div 
      className="flex flex-wrap items-center gap-3 px-6 py-3 border-b"
      style={{ borderColor, backgroundColor: bgColor }}
    >
      {/* Date Filter Mode Toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs hidden sm:inline" style={{ color: textMuted }}>Filter by:</span>
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
        >
          <button
            onClick={() => onDateFilterModeChange('created')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all"
            style={{
              backgroundColor: dateFilterMode === 'created' ? '#10b981' : 'transparent',
              color: dateFilterMode === 'created' ? 'white' : textSecondary
            }}
          >
            <Sparkles className="w-3 h-3" />
            <span>Created</span>
          </button>
          <button
            onClick={() => onDateFilterModeChange('activity')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all"
            style={{
              backgroundColor: dateFilterMode === 'activity' ? '#f59e0b' : 'transparent',
              color: dateFilterMode === 'activity' ? 'white' : textSecondary
            }}
          >
            <Clock className="w-3 h-3" />
            <span>Activity</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4" style={{ color: textMuted }} />
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
        >
          {DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onDateRangeChange(option.value)}
              className="px-3 py-2 text-xs font-medium transition-all"
              style={{
                backgroundColor: dateRange === option.value ? '#8b5cf6' : 'transparent',
                color: dateRange === option.value ? 'white' : textSecondary
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Forum Filter */}
      {forums.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: textMuted }} />
          <select
            value={selectedForumId || ''}
            onChange={(e) => onForumFilterChange(e.target.value || null)}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-all appearance-none cursor-pointer pr-8"
            style={{ 
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: textSecondary,
              border: 'none',
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23${isDark ? '71717a' : 'a1a1aa'}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.2em 1.2em'
            }}
          >
            <option value="">All Forums</option>
            {forums.map((forum) => (
              <option key={forum.id} value={forum.id}>
                {forum.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sort */}
      <div className="flex items-center gap-2 ml-auto">
        <ArrowUpDown className="w-4 h-4" style={{ color: textMuted }} />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-3 py-2 rounded-xl text-xs font-medium transition-all appearance-none cursor-pointer pr-8"
          style={{ 
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            color: textSecondary,
            border: 'none',
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23${isDark ? '71717a' : 'a1a1aa'}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.2em 1.2em'
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
