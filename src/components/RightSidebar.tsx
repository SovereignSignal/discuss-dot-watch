'use client';

import { useState } from 'react';
import { Search, Plus, X, Bell, BellOff } from 'lucide-react';
import { KeywordAlert } from '@/types';
import { sanitizeInput, sanitizeKeyword } from '@/lib/sanitize';

interface RightSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  alerts: KeywordAlert[];
  onAddAlert: (keyword: string) => void;
  onRemoveAlert: (id: string) => void;
  onToggleAlert: (id: string) => void;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
  isDark?: boolean;
}

export function RightSidebar({
  searchQuery,
  onSearchChange,
  alerts,
  onAddAlert,
  onRemoveAlert,
  onToggleAlert,
  isMobileOpen,
  onMobileToggle,
  isDark = true,
}: RightSidebarProps) {
  const [newKeyword, setNewKeyword] = useState('');

  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textPrimary = isDark ? '#e4e4e7' : '#18181b';
  const textSecondary = isDark ? '#a1a1aa' : '#71717a';
  const textMuted = isDark ? '#52525b' : '#a1a1aa';
  const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const handleAddAlert = () => {
    const sanitized = sanitizeKeyword(newKeyword);
    if (!sanitized) return;
    onAddAlert(sanitized);
    setNewKeyword('');
  };

  return (
    <>
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onMobileToggle} />
      )}
      
      <button
        onClick={onMobileToggle}
        className="md:hidden fixed bottom-4 right-4 z-30 p-3 rounded-full shadow-lg"
        style={{ backgroundColor: isDark ? '#27272a' : '#18181b', color: 'white' }}
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
      </button>

      <aside 
        className={`
          fixed md:relative w-72 flex flex-col h-full z-50 md:z-auto
          transition-transform duration-200
          ${isMobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          right-0 top-14 md:top-0 max-h-[calc(100vh-3.5rem)] md:max-h-full border-l
        `}
        style={{ 
          backgroundColor: isDark ? '#09090b' : '#ffffff',
          borderColor
        }}
      >
        {/* Search */}
        <div className="p-4 border-b" style={{ borderColor }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: textMuted }} />
            <input
              id="discussion-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(sanitizeInput(e.target.value))}
              placeholder="Search..."
              className="w-full pl-9 pr-8 py-2 rounded-md text-[13px]"
              style={{ backgroundColor: inputBg, color: textPrimary, border: 'none', outline: 'none' }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                style={{ color: textMuted }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="flex items-center gap-2 text-[12px] font-medium mb-3" style={{ color: textMuted }}>
            <Bell className="w-3.5 h-3.5" />
            Keyword Alerts
          </h3>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAlert()}
              placeholder="Add keyword..."
              className="flex-1 px-3 py-2 rounded-md text-[13px]"
              style={{ backgroundColor: inputBg, color: textPrimary, border: 'none', outline: 'none' }}
            />
            <button
              onClick={handleAddAlert}
              disabled={!newKeyword.trim()}
              className="p-2 rounded-md transition-colors disabled:opacity-30"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: textSecondary }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {alerts.length === 0 ? (
            <p className="text-[12px]" style={{ color: textMuted }}>No alerts set</p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md transition-colors"
                  style={{ 
                    backgroundColor: alert.isEnabled ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : 'transparent'
                  }}
                >
                  <span 
                    className="text-[13px] font-medium"
                    style={{ color: alert.isEnabled ? textPrimary : textMuted }}
                  >
                    {alert.keyword}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onToggleAlert(alert.id)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: alert.isEnabled ? textSecondary : textMuted }}
                    >
                      {alert.isEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onRemoveAlert(alert.id)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: textMuted }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 pt-4 border-t" style={{ borderColor }}>
            <p className="text-[11px] leading-relaxed" style={{ color: textMuted }}>
              Keywords highlight matching discussion titles. Use search to filter the feed.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
