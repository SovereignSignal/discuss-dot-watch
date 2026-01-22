'use client';

import { Calendar, Filter } from 'lucide-react';
import { DateRangeFilter } from '@/types';
import { Forum } from '@/types';

interface FeedFiltersProps {
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  selectedForumId: string | null;
  onForumFilterChange: (forumId: string | null) => void;
  forums: Forum[];
}

const DATE_RANGE_OPTIONS: { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export function FeedFilters({
  dateRange,
  onDateRangeChange,
  selectedForumId,
  onForumFilterChange,
  forums,
}: FeedFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 border-b theme-card" style={{ borderColor: 'var(--card-border)' }}>
      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 theme-text-muted" aria-hidden="true" />
        <div
          role="group"
          aria-label="Filter by date range"
          className="flex rounded-lg overflow-hidden border"
          style={{ borderColor: 'var(--card-border)' }}
        >
          {DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onDateRangeChange(option.value)}
              aria-pressed={dateRange === option.value}
              className={`px-3 py-2 min-h-[36px] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset ${
                dateRange === option.value
                  ? 'bg-red-600 text-white'
                  : 'theme-text-secondary hover:opacity-80'
              }`}
              style={dateRange !== option.value ? { backgroundColor: 'var(--card-bg)' } : undefined}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Forum Source Filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="forum-filter" className="sr-only">
          Filter by forum
        </label>
        <Filter className="w-4 h-4 theme-text-muted" aria-hidden="true" />
        <select
          id="forum-filter"
          value={selectedForumId || ''}
          onChange={(e) => onForumFilterChange(e.target.value || null)}
          className="px-3 py-2 min-h-[36px] text-xs rounded-lg theme-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)', border: '1px solid var(--card-border)' }}
        >
          <option value="">All Forums</option>
          {forums.map((forum) => (
            <option key={forum.id} value={forum.id}>
              {forum.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
