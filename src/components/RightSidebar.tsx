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

  const handleAddAlert = () => {
    const sanitized = sanitizeKeyword(newKeyword);
    if (!sanitized) return;
    onAddAlert(sanitized);
    setNewKeyword('');
  };

  const handleSearchChange = (value: string) => {
    onSearchChange(sanitizeInput(value));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddAlert();
    }
  };

  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const bgSurface = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';
  const textPrimary = isDark ? '#fafafa' : '#18181b';
  const textSecondary = isDark ? '#a1a1aa' : '#71717a';
  const textMuted = isDark ? '#71717a' : '#a1a1aa';

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onMobileToggle}
        />
      )}
      
      {/* Mobile toggle button */}
      <button
        onClick={onMobileToggle}
        className="md:hidden fixed bottom-4 right-4 z-30 p-3.5 rounded-full shadow-lg transition-all"
        style={{ backgroundColor: '#8b5cf6', color: 'white' }}
        aria-label={isMobileOpen ? 'Close search & alerts' : 'Open search & alerts'}
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
      </button>

      <aside 
        className={`
          fixed md:relative
          w-80 flex flex-col h-full
          z-50 md:z-auto
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          right-0 top-14 md:top-0
          max-h-[calc(100vh-3.5rem)] md:max-h-full
          backdrop-blur-xl border-l
        `}
        style={{ 
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor
        }}
      >
        {/* Search */}
        <div className="p-5 border-b" style={{ borderColor }}>
          <div className="relative">
            <Search 
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: textMuted }}
            />
            <input
              id="discussion-search"
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search discussions..."
              className="w-full pl-10 pr-10 py-3 rounded-xl text-sm transition-all"
              style={{ 
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                color: textPrimary,
                border: 'none',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                style={{ color: textMuted }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="flex-1 p-5 overflow-y-auto">
          <div className="mb-6">
            <h3 
              className="flex items-center gap-2 text-sm font-medium mb-4"
              style={{ color: textSecondary }}
            >
              <Bell className="w-4 h-4" />
              Keyword Alerts
            </h3>
            
            <div 
              className="text-xs p-3 rounded-xl mb-4"
              style={{ 
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                color: textMuted
              }}
            >
              <p className="mb-1">
                <strong style={{ color: textSecondary }}>Note:</strong> Alerts highlight matching keywords in discussion titles.
              </p>
              <p>Use the search box above to filter/hide non-matching discussions.</p>
            </div>

            {/* Add keyword */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add keyword..."
                className="flex-1 px-4 py-3 rounded-xl text-sm transition-all"
                style={{ 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  color: textPrimary,
                  border: 'none'
                }}
              />
              <button
                onClick={handleAddAlert}
                disabled={!newKeyword.trim()}
                className="p-3 rounded-xl transition-all disabled:opacity-40"
                style={{ backgroundColor: '#8b5cf6', color: 'white' }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Alert list */}
            {alerts.length === 0 ? (
              <p className="text-sm" style={{ color: textMuted }}>No keyword alerts set</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                    style={{
                      backgroundColor: alert.isEnabled 
                        ? (isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.08)')
                        : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                      border: alert.isEnabled 
                        ? '1px solid rgba(139, 92, 246, 0.2)'
                        : `1px solid ${borderColor}`
                    }}
                  >
                    <span 
                      className="text-sm font-medium"
                      style={{ color: alert.isEnabled ? textPrimary : textMuted }}
                    >
                      {alert.keyword}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggleAlert(alert.id)}
                        className="p-2 rounded-lg transition-all"
                        style={{ 
                          color: alert.isEnabled ? '#8b5cf6' : textMuted,
                          backgroundColor: alert.isEnabled ? 'rgba(139, 92, 246, 0.1)' : 'transparent'
                        }}
                      >
                        {alert.isEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => onRemoveAlert(alert.id)}
                        className="p-2 rounded-lg transition-all hover:text-rose-500"
                        style={{ color: textMuted }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tips */}
          <div className="pt-4 border-t" style={{ borderColor }}>
            <h3 className="text-sm font-medium mb-3" style={{ color: textSecondary }}>Tips</h3>
            <ul className="text-xs space-y-1.5" style={{ color: textMuted }}>
              <li>• Click on a discussion to open it in a new tab</li>
              <li>• Matching keywords are highlighted in the title</li>
              <li>• Enable/disable forums in the Communities tab</li>
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}
