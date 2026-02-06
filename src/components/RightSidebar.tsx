'use client';

import { useState } from 'react';
import { Search, Plus, X, Bell, BellOff, Filter } from 'lucide-react';
import { KeywordAlert } from '@/types';
import { sanitizeInput, sanitizeKeyword } from '@/lib/sanitize';

interface RightSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  alerts: KeywordAlert[];
  onAddAlert: (keyword: string) => void;
  onRemoveAlert: (id: string) => void;
  onToggleAlert: (id: string) => void;
  activeKeywordFilter: string | null; // null = no filter, 'all' = any keyword, or specific keyword
  onKeywordFilterChange: (filter: string | null) => void;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
  isDark?: boolean;
}

export function RightSidebar({
  searchQuery, onSearchChange,
  alerts, onAddAlert, onRemoveAlert, onToggleAlert,
  activeKeywordFilter, onKeywordFilterChange,
  isMobileOpen, onMobileToggle,
  isDark = true,
}: RightSidebarProps) {
  const [newKeyword, setNewKeyword] = useState('');

  const borderColor = isDark ? '#27272a' : 'rgba(0,0,0,0.06)';
  const textPrimary = isDark ? '#fafafa' : '#09090b';
  const textSecondary = isDark ? '#e4e4e7' : '#3f3f46';
  const textMuted = isDark ? '#a1a1aa' : '#52525b';
  const inputBg = isDark ? '#18181b' : 'rgba(0,0,0,0.03)';
  const activeBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const handleAddAlert = () => {
    const sanitized = sanitizeKeyword(newKeyword);
    if (!sanitized) return;
    onAddAlert(sanitized);
    setNewKeyword('');
  };

  const enabledAlerts = alerts.filter(a => a.isEnabled);

  return (
    <>
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onMobileToggle} />
      )}
      
      <button onClick={onMobileToggle}
        className="md:hidden fixed bottom-4 right-4 z-30 p-3 rounded-full shadow-lg"
        style={{ backgroundColor: isDark ? '#27272a' : '#18181b', color: 'white' }}>
        {isMobileOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
      </button>

      <aside className={`
        fixed md:relative w-72 flex flex-col h-full z-50 md:z-auto
        transition-transform duration-200
        ${isMobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        right-0 top-14 md:top-0 max-h-[calc(100vh-3.5rem)] md:max-h-full border-l
      `} style={{ backgroundColor: isDark ? '#111111' : '#ffffff', borderColor }}>
        {/* Search */}
        <div className="p-4 border-b" style={{ borderColor }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: textMuted }} />
            <input id="discussion-search" type="search"
              value={searchQuery} onChange={(e) => onSearchChange(sanitizeInput(e.target.value))}
              placeholder="Search..."
              className="w-full pl-9 pr-8 py-2 rounded-md text-sm"
              style={{ backgroundColor: inputBg, color: textPrimary, border: 'none', outline: 'none' }}
            />
            {searchQuery && (
              <button onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1" style={{ color: textMuted }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Keyword Alerts */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="flex items-center gap-2 text-xs font-medium mb-3" style={{ color: textMuted }}>
            <Bell className="w-3.5 h-3.5" />
            Keyword Alerts
          </h3>

          <div className="flex gap-2 mb-3">
            <input type="text" value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAlert()}
              placeholder="Add keyword..."
              className="flex-1 px-3 py-2 rounded-md text-sm"
              style={{ backgroundColor: inputBg, color: textPrimary, border: 'none', outline: 'none' }}
            />
            <button onClick={handleAddAlert} disabled={!newKeyword.trim()}
              className="p-2 rounded-md transition-colors disabled:opacity-30"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: textSecondary }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Filter buttons */}
          {enabledAlerts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button onClick={() => onKeywordFilterChange(activeKeywordFilter === null ? 'all' : null)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: activeKeywordFilter !== null ? activeBg : 'transparent',
                  color: activeKeywordFilter !== null ? textPrimary : textMuted,
                  border: `1px solid ${activeKeywordFilter !== null ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : 'transparent'}`,
                }}>
                <Filter className="w-3 h-3" />
                {activeKeywordFilter !== null ? 'Filtering' : 'Filter feed'}
              </button>
              {activeKeywordFilter !== null && (
                <button onClick={() => onKeywordFilterChange(null)}
                  className="px-2 py-1 rounded-md text-xs font-medium transition-colors"
                  style={{ color: textMuted }}>
                  Clear
                </button>
              )}
            </div>
          )}

          {alerts.length === 0 ? (
            <p className="text-xs" style={{ color: textMuted }}>No alerts set</p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((alert) => {
                const isActive = activeKeywordFilter === alert.keyword;
                return (
                  <li key={alert.id}
                    className="flex items-center justify-between px-3 py-2 rounded-md transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isActive ? activeBg : (alert.isEnabled ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : 'transparent'),
                      border: `1px solid ${isActive ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : 'transparent'}`,
                    }}
                    onClick={() => {
                      if (!alert.isEnabled) return;
                      if (isActive) {
                        onKeywordFilterChange(null);
                      } else {
                        onKeywordFilterChange(alert.keyword);
                      }
                    }}
                  >
                    <span className="text-sm font-medium" style={{ color: alert.isEnabled ? textPrimary : textMuted }}>
                      {alert.keyword}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button onClick={(e) => { e.stopPropagation(); onToggleAlert(alert.id); }}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: alert.isEnabled ? textSecondary : textMuted }}>
                        {alert.isEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onRemoveAlert(alert.id); }}
                        className="p-1.5 rounded transition-colors" style={{ color: textMuted }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6 pt-4 border-t" style={{ borderColor }}>
            <p className="text-xs leading-relaxed" style={{ color: textMuted }}>
              Click a keyword to filter the feed. Keywords also highlight matching titles.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
