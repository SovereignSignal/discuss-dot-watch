'use client';

interface FilterTabsProps {
  filterMode: 'all' | 'your';
  onFilterChange: (mode: 'all' | 'your') => void;
  totalCount: number;
  enabledCount: number;
  isDark?: boolean;
}

export function FilterTabs({
  filterMode,
  onFilterChange,
  totalCount,
  enabledCount,
  isDark = true,
}: FilterTabsProps) {
  return (
    <div 
      className="flex items-center gap-1 p-1 rounded-xl"
      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
    >
      <button
        onClick={() => onFilterChange('your')}
        className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
        style={{
          backgroundColor: filterMode === 'your' ? '#8b5cf6' : 'transparent',
          color: filterMode === 'your' ? 'white' : (isDark ? '#a1a1aa' : '#71717a')
        }}
      >
        Your Projects ({enabledCount})
      </button>
      <button
        onClick={() => onFilterChange('all')}
        className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
        style={{
          backgroundColor: filterMode === 'all' ? '#8b5cf6' : 'transparent',
          color: filterMode === 'all' ? 'white' : (isDark ? '#a1a1aa' : '#71717a')
        }}
      >
        All Projects ({totalCount})
      </button>
    </div>
  );
}
