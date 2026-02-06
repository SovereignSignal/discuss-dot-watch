'use client';

import { ArrowUpDown } from 'lucide-react';
import { DateRangeFilter, DateFilterMode, SortOption, Forum } from '@/types';

interface FeedFiltersProps {
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  dateFilterMode: DateFilterMode;
  onDateFilterModeChange: (mode: DateFilterMode) => void;
  selectedForumId: string | null;
  onForumFilterChange: (forumId: string | null) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
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

const CATEGORY_OPTIONS = [
  { value: null as string | null, label: 'All' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'ai', label: 'AI' },
  { value: 'oss', label: 'OSS' },
];

function resolveCategory(cat?: string): string | null {
  if (!cat) return null;
  if (cat.startsWith('crypto')) return 'crypto';
  if (cat.startsWith('ai')) return 'ai';
  if (cat.startsWith('oss')) return 'oss';
  return null;
}

export function FeedFilters({
  dateRange, onDateRangeChange,
  dateFilterMode, onDateFilterModeChange,
  selectedForumId, onForumFilterChange,
  selectedCategory, onCategoryChange,
  forums, sortBy, onSortChange,
  isDark = true,
}: FeedFiltersProps) {
  const borderColor = isDark ? '#27272a' : 'rgba(0,0,0,0.06)';
  const textMuted = isDark ? '#a1a1aa' : '#52525b';
  const textSecondary = isDark ? '#e4e4e7' : '#3f3f46';
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const selectBg = isDark ? '#18181b' : 'rgba(0,0,0,0.03)';

  // Filter forums by selected category for the dropdown
  const filteredForums = selectedCategory
    ? forums.filter(f => resolveCategory(f.category) === selectedCategory)
    : forums;

  // Count forums per category
  const categoryCounts = CATEGORY_OPTIONS.map(opt => ({
    ...opt,
    count: opt.value === null ? forums.length : forums.filter(f => resolveCategory(f.category) === opt.value).length,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b text-[13px]" style={{ borderColor }}>
      {/* Category filter */}
      <div className="flex items-center gap-0.5">
        {categoryCounts.filter(c => c.count > 0 || c.value === null).map((opt) => (
          <button key={opt.label}
            onClick={() => { onCategoryChange(opt.value); onForumFilterChange(null); }}
            className="px-2.5 py-1 rounded-md font-medium transition-colors"
            style={{
              backgroundColor: selectedCategory === opt.value ? activeBg : 'transparent',
              color: selectedCategory === opt.value ? textSecondary : textMuted,
            }}>
            {opt.label}
            {opt.value !== null && <span className="ml-1 opacity-60">{opt.count}</span>}
          </button>
        ))}
      </div>

      <div className="w-px h-4" style={{ backgroundColor: borderColor }} />

      {/* Date filter mode */}
      <div className="flex items-center gap-0.5">
        <button onClick={() => onDateFilterModeChange('created')}
          className="px-2 py-1 rounded-md font-medium transition-colors"
          style={{ backgroundColor: dateFilterMode === 'created' ? activeBg : 'transparent', color: dateFilterMode === 'created' ? textSecondary : textMuted }}>
          Created
        </button>
        <button onClick={() => onDateFilterModeChange('activity')}
          className="px-2 py-1 rounded-md font-medium transition-colors"
          style={{ backgroundColor: dateFilterMode === 'activity' ? activeBg : 'transparent', color: dateFilterMode === 'activity' ? textSecondary : textMuted }}>
          Activity
        </button>
      </div>

      <div className="w-px h-4" style={{ backgroundColor: borderColor }} />

      {/* Date range */}
      <div className="flex items-center gap-0.5">
        {DATE_RANGE_OPTIONS.map((option) => (
          <button key={option.value}
            onClick={() => onDateRangeChange(option.value)}
            className="px-2 py-1 rounded-md font-medium transition-colors"
            style={{ backgroundColor: dateRange === option.value ? activeBg : 'transparent', color: dateRange === option.value ? textSecondary : textMuted }}>
            {option.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4" style={{ backgroundColor: borderColor }} />

      {/* Forum filter */}
      {filteredForums.length > 0 && (
        <select value={selectedForumId || ''}
          onChange={(e) => onForumFilterChange(e.target.value || null)}
          className="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
          style={{ backgroundColor: selectedForumId ? activeBg : selectBg, color: textSecondary, border: 'none', fontSize: '13px' }}>
          <option value="">{selectedCategory ? `All ${selectedCategory}` : 'All forums'}</option>
          {filteredForums.map((forum) => (
            <option key={forum.id} value={forum.id}>{forum.name}</option>
          ))}
        </select>
      )}

      {/* Sort */}
      <div className="flex items-center gap-1 ml-auto">
        <ArrowUpDown className="w-3 h-3" style={{ color: textMuted }} />
        <select value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="px-2 py-1 rounded-md font-medium transition-colors cursor-pointer"
          style={{ backgroundColor: selectBg, color: textSecondary, border: 'none', fontSize: '13px' }}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
