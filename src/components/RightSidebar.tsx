'use client';

import { useState } from 'react';
import { Search, Plus, X, Bell, BellOff } from 'lucide-react';
import { KeywordAlert } from '@/types';

interface RightSidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  alerts: KeywordAlert[];
  onAddAlert: (keyword: string) => void;
  onRemoveAlert: (id: string) => void;
  onToggleAlert: (id: string) => void;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
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
}: RightSidebarProps) {
  const [newKeyword, setNewKeyword] = useState('');

  const handleAddAlert = () => {
    if (!newKeyword.trim()) return;
    onAddAlert(newKeyword.trim());
    setNewKeyword('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddAlert();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onMobileToggle}
          aria-hidden="true"
        />
      )}
      
      {/* Mobile toggle button */}
      <button
        onClick={onMobileToggle}
        className="md:hidden fixed bottom-4 right-4 z-30 p-3 min-w-[48px] min-h-[48px] flex items-center justify-center bg-red-600 text-white rounded-full shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        aria-label={isMobileOpen ? 'Close search & alerts' : 'Open search & alerts'}
        aria-expanded={isMobileOpen}
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
      </button>

      <aside className={`
        fixed md:relative
        w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full
        z-50 md:z-auto
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        right-0 top-14 md:top-0
        max-h-[calc(100vh-3.5rem)] md:max-h-full
      `}>
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <label htmlFor="discussion-search" className="sr-only">
            Search discussions
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
          <input
            id="discussion-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search discussions..."
            className="w-full pl-10 pr-10 py-2 min-h-[44px] bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-500 hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="mb-6">
          <h3 className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
            <Bell className="w-4 h-4" />
            Keyword Alerts
          </h3>
          <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-800/50 rounded-lg">
            <p className="mb-1"><strong className="text-gray-400">Note:</strong> Alerts highlight matching discussions with a yellow border.</p>
            <p>Use the search box above to filter/hide non-matching discussions.</p>
          </div>
          
          <div className="flex gap-2 mb-3">
            <label htmlFor="new-keyword" className="sr-only">
              Add keyword alert
            </label>
            <input
              id="new-keyword"
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add keyword..."
              className="flex-1 px-3 py-2 min-h-[44px] bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 text-sm"
            />
            <button
              onClick={handleAddAlert}
              disabled={!newKeyword.trim()}
              aria-label="Add keyword alert"
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {alerts.length === 0 ? (
            <p className="text-gray-400 text-sm" role="status">No keyword alerts set</p>
          ) : (
            <ul className="space-y-2" role="list" aria-label="Keyword alerts">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    alert.isEnabled ? 'bg-yellow-900/20' : 'bg-gray-800/50'
                  }`}
                >
                  <span className={`text-sm ${alert.isEnabled ? 'text-yellow-200' : 'text-gray-500'}`}>
                    {alert.keyword}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleAlert(alert.id)}
                      className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-500 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={alert.isEnabled ? `Disable alert for "${alert.keyword}"` : `Enable alert for "${alert.keyword}"`}
                      aria-pressed={alert.isEnabled}
                    >
                      {alert.isEnabled ? (
                        <Bell className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <BellOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => onRemoveAlert(alert.id)}
                      className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={`Remove alert for "${alert.keyword}"`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-4 border-t border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Tips</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Click on a discussion to open it in a new tab</li>
            <li>• Matching keywords are highlighted in yellow</li>
            <li>• Enable/disable forums in the Projects tab</li>
          </ul>
        </div>
      </div>
    </aside>
    </>
  );
}
