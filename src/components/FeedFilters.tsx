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
    <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 dark:border-gray-800 light:border-gray-200 bg-gray-900/50 dark:bg-gray-900/50 light:bg-gray-50">
      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-500" />
        <div className="flex rounded-lg overflow-hidden border border-gray-700 dark:border-gray-700 light:border-gray-300">
          {DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onDateRangeChange(option.value)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                dateRange === option.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 dark:bg-gray-800 light:bg-white text-gray-400 dark:text-gray-400 light:text-gray-600 hover:bg-gray-700 dark:hover:bg-gray-700 light:hover:bg-gray-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Forum Source Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <select
          value={selectedForumId || ''}
          onChange={(e) => onForumFilterChange(e.target.value || null)}
          className="px-3 py-1 text-xs bg-gray-800 dark:bg-gray-800 light:bg-white border border-gray-700 dark:border-gray-700 light:border-gray-300 rounded-lg text-gray-300 dark:text-gray-300 light:text-gray-700 focus:outline-none focus:border-indigo-500"
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
