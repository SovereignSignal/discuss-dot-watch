'use client';

import { c } from '@/lib/theme';

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
  const t = c(isDark);

  return (
    <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ backgroundColor: t.bgCard }}>
      <button
        onClick={() => onFilterChange('your')}
        className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        style={{
          backgroundColor: filterMode === 'your' ? t.bgActive : 'transparent',
          color: filterMode === 'your' ? t.fg : t.fgMuted
        }}
      >
        Your Forums ({enabledCount})
      </button>
      <button
        onClick={() => onFilterChange('all')}
        className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        style={{
          backgroundColor: filterMode === 'all' ? t.bgActive : 'transparent',
          color: filterMode === 'all' ? t.fg : t.fgMuted
        }}
      >
        All Forums ({totalCount})
      </button>
    </div>
  );
}
