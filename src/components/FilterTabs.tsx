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
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textActive = isDark ? '#e4e4e7' : '#18181b';
  const textInactive = isDark ? '#52525b' : '#a1a1aa';

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onFilterChange('your')}
        className="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
        style={{
          backgroundColor: filterMode === 'your' ? activeBg : 'transparent',
          color: filterMode === 'your' ? textActive : textInactive
        }}
      >
        Your Forums ({enabledCount})
      </button>
      <button
        onClick={() => onFilterChange('all')}
        className="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
        style={{
          backgroundColor: filterMode === 'all' ? activeBg : 'transparent',
          color: filterMode === 'all' ? textActive : textInactive
        }}
      >
        All ({totalCount})
      </button>
    </div>
  );
}
