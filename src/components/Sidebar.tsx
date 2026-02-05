'use client';

import { LayoutGrid, FolderOpen, Settings, Bookmark, Sun, Moon, Menu, X } from 'lucide-react';
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
  const isDark = theme === 'dark';
  
  const navItems = [
    { id: 'feed' as const, label: 'Feed', icon: LayoutGrid },
    { id: 'projects' as const, label: 'Communities', icon: FolderOpen },
    { id: 'saved' as const, label: 'Saved', icon: Bookmark, count: savedCount },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (view: typeof activeView) => {
    onViewChange(view);
    if (isMobileOpen) {
      onMobileToggle();
    }
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div 
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 backdrop-blur-xl border-b"
        style={{ 
          backgroundColor: isDark ? 'rgba(9, 9, 11, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDark ? 'rgba(63, 63, 70, 0.4)' : 'rgba(0, 0, 0, 0.1)'
        }}
      >
        <button
          onClick={onMobileToggle}
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
          aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileOpen}
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">👁️‍🗨️</span>
          <span className="font-semibold text-sm tracking-tight">discuss.watch</span>
        </div>
        <button
          onClick={onToggleTheme}
          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onMobileToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative
          w-72 flex flex-col h-full
          z-50 md:z-auto
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          top-0 md:top-auto
          pt-14 md:pt-0
          backdrop-blur-xl border-r
        `}
        style={{ 
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? 'rgba(63, 63, 70, 0.4)' : 'rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Logo Section */}
        <div 
          className="p-5 border-b hidden md:block"
          style={{ borderColor: isDark ? 'rgba(63, 63, 70, 0.4)' : 'rgba(0, 0, 0, 0.1)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👁️‍🗨️</span>
              <div>
                <h1 className="text-base font-semibold tracking-tight">discuss.watch</h1>
                <p className="text-xs opacity-50">Unified forum feed</p>
              </div>
            </div>
            <button
              onClick={onToggleTheme}
              className="p-2 flex items-center justify-center rounded-lg transition-all hover:scale-105"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {/* Navigation */}
        <nav id="navigation" className="flex-1 p-3" aria-label="Main navigation">
          <ul className="space-y-1" role="list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-all duration-200
                      ${isActive 
                        ? isDark 
                          ? 'bg-violet-500/15 text-violet-300' 
                          : 'bg-violet-500/10 text-violet-600'
                        : isDark
                          ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                      }
                    `}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-violet-400' : ''}`} />
                    <span>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span 
                        className={`
                          ml-auto px-2 py-0.5 text-xs rounded-full font-medium
                          ${isActive 
                            ? 'bg-violet-500/20 text-violet-300' 
                            : isDark 
                              ? 'bg-zinc-700 text-zinc-400' 
                              : 'bg-zinc-200 text-zinc-600'
                          }
                        `}
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

        {/* User Section */}
        <div 
          className="p-4 border-t"
          style={{ borderColor: isDark ? 'rgba(63, 63, 70, 0.4)' : 'rgba(0, 0, 0, 0.1)' }}
        >
          <UserButton />
        </div>
      </aside>
    </>
  );
}
