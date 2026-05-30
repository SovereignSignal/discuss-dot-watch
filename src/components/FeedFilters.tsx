'use client';

import { ArrowUpDown } from 'lucide-react';
import { DateRangeFilter, DateFilterMode, SortOption, Forum } from '@/types';

interface ForumOption {
  value: string;
  label: string;
  category?: string;
}

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
  /** When provided (server mode), use this list for the forum dropdown instead of user's enabled forums */
  allForumsList?: ForumOption[];
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
  allForumsList,
}: FeedFiltersProps) {
  const useServerForums = !!allForumsList;

  // Filter forums by selected category for the dropdown
  const filteredForums = useServerForums
    ? (selectedCategory
      ? allForumsList.filter(f => f.category === selectedCategory)
      : allForumsList)
    : (selectedCategory
      ? forums.filter(f => resolveCategory(f.category) === selectedCategory)
      : forums);

  // Count forums per category
  const countSource = useServerForums ? allForumsList : forums;
  const categoryCounts = CATEGORY_OPTIONS.map(opt => ({
    ...opt,
    count: opt.value === null
      ? countSource.length
      : useServerForums
        ? (countSource as ForumOption[]).filter(f => f.category === opt.value).length
        : (countSource as Forum[]).filter(f => resolveCategory(f.category) === opt.value).length,
  }));

  // Sprint 17: rebuilt with --ds-* tokens. Each filter "group" uses the same
  // pill pattern from the design system: the track is --ds-bg-elev; the active
  // chip reads as a soft "raised" selection one contrast-step above the track
  // (--ds-bg-subtle) with full-strength text. Both tokens flip per-theme, so
  // this stays gentle in light mode instead of the old hard --ds-fg invert,
  // which rendered as a jarring near-black chip on the light background.
  const activeBg = 'var(--ds-bg-subtle)';
  const activeFg = 'var(--ds-fg)';
  const inactiveBg = 'transparent';
  const inactiveFg = 'var(--ds-fg-muted)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '10px 20px',
        borderBottom: `1px solid var(--ds-border)`,
        background: 'var(--ds-bg-base)',
        fontSize: 'var(--ds-text-sm)',
        fontFamily: 'var(--ds-font-sans)',
      }}
    >
      {/* Category filter — grouped pill bar */}
      <div style={{ display: 'inline-flex', background: 'var(--ds-bg-elev)', border: `1px solid var(--ds-border)`, borderRadius: 'var(--ds-radius-md)', padding: 2, gap: 2 }}>
        {categoryCounts.filter(c => c.count > 0 || c.value === null).map((opt) => {
          const active = selectedCategory === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => { onCategoryChange(opt.value); onForumFilterChange(null); }}
              style={{
                background: active ? activeBg : inactiveBg,
                color: active ? activeFg : inactiveFg,
                border: 'none',
                borderRadius: 'var(--ds-radius-sm)',
                padding: '4px 10px',
                fontSize: 'var(--ds-text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--ds-font-sans)',
              }}
            >
              {opt.label}
              {opt.value !== null && (
                <span style={{ marginLeft: 4, opacity: 0.6, fontFamily: 'var(--ds-font-mono)' }}>{opt.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Date filter mode */}
      <div style={{ display: 'inline-flex', background: 'var(--ds-bg-elev)', border: `1px solid var(--ds-border)`, borderRadius: 'var(--ds-radius-md)', padding: 2, gap: 2 }}>
        {([
          { value: 'created' as const, label: 'New' },
          { value: 'activity' as const, label: 'Active' },
        ]).map((opt) => {
          const active = dateFilterMode === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onDateFilterModeChange(opt.value)}
              style={{
                background: active ? activeBg : inactiveBg,
                color: active ? activeFg : inactiveFg,
                border: 'none',
                borderRadius: 'var(--ds-radius-sm)',
                padding: '4px 10px',
                fontSize: 'var(--ds-text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--ds-font-sans)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Date range */}
      <div style={{ display: 'inline-flex', background: 'var(--ds-bg-elev)', border: `1px solid var(--ds-border)`, borderRadius: 'var(--ds-radius-md)', padding: 2, gap: 2 }}>
        {DATE_RANGE_OPTIONS.map((option) => {
          const active = dateRange === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onDateRangeChange(option.value)}
              style={{
                background: active ? activeBg : inactiveBg,
                color: active ? activeFg : inactiveFg,
                border: 'none',
                borderRadius: 'var(--ds-radius-sm)',
                padding: '4px 10px',
                fontSize: 'var(--ds-text-xs)',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--ds-font-sans)',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Forum filter dropdown */}
      {filteredForums.length > 0 && (
        <select
          value={selectedForumId || ''}
          onChange={(e) => onForumFilterChange(e.target.value || null)}
          style={{
            background: selectedForumId ? 'var(--ds-fg)' : 'var(--ds-bg-elev)',
            color: selectedForumId ? 'var(--ds-bg-base)' : 'var(--ds-fg)',
            border: `1px solid var(--ds-border)`,
            borderRadius: 'var(--ds-radius-md)',
            padding: '5px 10px',
            fontSize: 'var(--ds-text-xs)',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--ds-font-sans)',
          }}
        >
          <option value="">{selectedCategory ? `All ${selectedCategory}` : 'All forums'}</option>
          {useServerForums
            ? (filteredForums as ForumOption[]).map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))
            : (filteredForums as Forum[]).map((forum) => (
                <option key={forum.id} value={forum.id}>{forum.name}</option>
              ))}
        </select>
      )}

      {/* Sort */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        <ArrowUpDown size={12} style={{ color: 'var(--ds-fg-dim)' }} />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          style={{
            background: 'var(--ds-bg-elev)',
            color: 'var(--ds-fg)',
            border: `1px solid var(--ds-border)`,
            borderRadius: 'var(--ds-radius-md)',
            padding: '5px 10px',
            fontSize: 'var(--ds-text-xs)',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--ds-font-sans)',
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
