'use client';

import { LayoutGrid, FolderOpen, Settings, Bell } from 'lucide-react';

interface SidebarProps {
  activeView: 'feed' | 'projects' | 'settings';
  onViewChange: (view: 'feed' | 'projects' | 'settings') => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const navItems = [
    { id: 'feed' as const, label: 'Feed', icon: LayoutGrid },
    { id: 'projects' as const, label: 'Projects', icon: FolderOpen },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Bell className="w-6 h-6 text-indigo-400" />
          <h1 className="text-lg font-semibold text-white">Gov Watch</h1>
        </div>
        <p className="text-xs text-gray-500 mt-1">Governance Forum Aggregator</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">
          Aggregating governance discussions from Discourse forums
        </p>
      </div>
    </aside>
  );
}
