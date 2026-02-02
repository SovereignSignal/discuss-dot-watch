'use client';

import { LayoutGrid, FolderOpen, Settings, Bell, Bookmark, Sun, Moon, Menu, X } from 'lucide-react';
import { UserButton } from './UserButton';

interface SidebarProps {
  activeView: 'feed' | 'projects' | 'saved' | 'settings';
  onViewChange: (view: 'feed' | 'projects' | 'saved' | 'settings') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  savedCount?: number;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
}

export function Sidebar({ activeView, onViewChange, theme, onToggleTheme, savedCount = 0, isMobileOpen, onMobileToggle }: SidebarProps) {
  const navItems = [
    { id: 'feed' as const, label: 'Feed', icon: LayoutGrid },
    { id: 'projects' as const, label: 'Projects', icon: FolderOpen },
    { id: 'saved' as const, label: 'Saved', icon: Bookmark, count: savedCount },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (view: typeof activeView) => {
    onViewChange(view);
    // Only toggle if mobile menu is open (avoid unnecessary state updates on desktop)
    if (isMobileOpen) {
      onMobileToggle();
    }
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-2 py-2 theme-sidebar border-b" style={{ borderColor: 'var(--card-border)' }}>
        <button
          onClick={onMobileToggle}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center theme-text-secondary rounded-lg flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileOpen}
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-1 min-w-0">
          <Bell className="w-4 h-4 text-indigo-500 flex-shrink-0" aria-hidden="true" />
          <span className="font-semibold theme-text text-sm truncate">Gov Watch</span>
        </div>
        <button
          onClick={onToggleTheme}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center theme-text-secondary rounded-lg flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onMobileToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative
        w-64 theme-sidebar border-r flex flex-col h-full
        z-50 md:z-auto
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        top-0 md:top-auto
        pt-14 md:pt-0
      `}>
      <div className="p-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-500" aria-hidden="true" />
            <h1 className="text-lg font-semibold theme-text">Gov Watch</h1>
          </div>
          <button
            onClick={onToggleTheme}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center theme-text-secondary hover:opacity-80 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs theme-text-muted mt-1">Governance Forum Aggregator</p>
      </div>
      
      <nav id="navigation" className="flex-1 p-4" aria-label="Main navigation">
        <ul className="space-y-1" role="list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-3 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'theme-text-secondary hover:opacity-80'
                  }`}
                  style={!isActive ? { backgroundColor: 'transparent' } : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    {item.label}
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${isActive ? 'bg-white/20' : ''}`}
                      style={!isActive ? { backgroundColor: 'var(--card-border)' } : undefined}
                      aria-label={`${item.count} saved`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* User authentication section */}
      <div className="px-4 py-3 border-t hidden md:block" style={{ borderColor: 'var(--card-border)' }}>
        <UserButton />
      </div>

      <div className="p-4 border-t hidden md:block" style={{ borderColor: 'var(--card-border)' }}>
        <p className="text-xs theme-text-muted">
          Aggregating governance discussions from Discourse forums
        </p>
      </div>
      </aside>
    </>
  );
}
