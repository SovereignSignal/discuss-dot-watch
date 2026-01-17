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
}

export function RightSidebar({
  searchQuery,
  onSearchChange,
  alerts,
  onAddAlert,
  onRemoveAlert,
  onToggleAlert,
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
    <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search discussions..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
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
          <p className="text-xs text-gray-500 mb-3">
            Highlight discussions containing these keywords
          </p>
          
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add keyword..."
              className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
            />
            <button
              onClick={handleAddAlert}
              disabled={!newKeyword.trim()}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {alerts.length === 0 ? (
            <p className="text-gray-600 text-sm">No keyword alerts set</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
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
                      className="p-1 text-gray-500 hover:text-white transition-colors"
                    >
                      {alert.isEnabled ? (
                        <Bell className="w-3.5 h-3.5 text-yellow-400" />
                      ) : (
                        <BellOff className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => onRemoveAlert(alert.id)}
                      className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
  );
}
