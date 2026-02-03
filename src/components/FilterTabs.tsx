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
    <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--card-border)' }}>
      <button
        onClick={() => onFilterChange('your')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
          filterMode === 'your'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'theme-text-secondary hover:opacity-80'
        }`}
      >
        Your Projects ({enabledCount})
      </button>
      <button
        onClick={() => onFilterChange('all')}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
          filterMode === 'all'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'theme-text-secondary hover:opacity-80'
        }`}
      >
        All Projects ({totalCount})
      </button>
    </div>
  );
}
