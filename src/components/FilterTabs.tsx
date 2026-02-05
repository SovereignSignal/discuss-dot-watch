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
  const fg = isDark ? '#fafafa' : '#09090b';
  const fgMuted = isDark ? '#52525b' : '#a1a1aa';
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
      <button
        onClick={() => onFilterChange('your')}
        className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        style={{
          backgroundColor: filterMode === 'your' ? activeBg : 'transparent',
          color: filterMode === 'your' ? fg : fgMuted
        }}
      >
        Your Forums ({enabledCount})
      </button>
      <button
        onClick={() => onFilterChange('all')}
        className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        style={{
          backgroundColor: filterMode === 'all' ? activeBg : 'transparent',
          color: filterMode === 'all' ? fg : fgMuted
        }}
      >
        All ({totalCount})
      </button>
    </div>
  );
}
