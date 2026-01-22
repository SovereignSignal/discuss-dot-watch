'use client';

interface FilterTabsProps {
  filterMode: 'all' | 'your';
  onFilterChange: (mode: 'all' | 'your') => void;
  totalCount: number;
  enabledCount: number;
}

export function FilterTabs({
  filterMode,
  onFilterChange,
  totalCount,
  enabledCount,
}: FilterTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-800 rounded-lg">
      <button
        onClick={() => onFilterChange('your')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
          filterMode === 'your'
            ? 'bg-red-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        Your Projects ({enabledCount})
      </button>
      <button
        onClick={() => onFilterChange('all')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
          filterMode === 'all'
            ? 'bg-red-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        All Projects ({totalCount})
      </button>
    </div>
  );
}
