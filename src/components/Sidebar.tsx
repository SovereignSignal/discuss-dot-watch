'use client';

import { LayoutGrid, FolderOpen, Settings, Bookmark, Sun, Moon, Menu, X, Shield } from 'lucide-react';
import { UserButton } from './UserButton';
import { useAuth } from './AuthProvider';
import { isAdminEmail } from '@/lib/admin';

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
  const borderColor = isDark ? '#27272a' : 'rgba(0,0,0,0.06)';
  const textPrimary = isDark ? '#fafafa' : '#09090b';
  const textMuted = isDark ? '#a1a1aa' : '#52525b';
  const { user } = useAuth();
  const userIsAdmin = isAdminEmail(user?.email);
  
  const navItems = [
    { id: 'feed' as const, label: 'Feed', icon: LayoutGrid },
    { id: 'projects' as const, label: 'Communities', icon: FolderOpen },
    { id: 'saved' as const, label: 'Saved', icon: Bookmark, count: savedCount },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (view: typeof activeView) => {
    onViewChange(view);
    if (isMobileOpen) onMobileToggle();
  };

  return (
    <>
      {/* Mobile Header */}
      <div 
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 border-b"
        style={{ 
          backgroundColor: isDark ? '#111111' : '#ffffff',
          borderColor
        }}
      >
        <button onClick={onMobileToggle} className="p-2 -ml-2">
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">👁️‍🗨️</span>
          <span className="text-sm font-semibold tracking-tight">discuss.watch</span>
        </div>
        <button onClick={onToggleTheme} className="p-2 -mr-2" style={{ color: textMuted }}>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onMobileToggle} />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative w-56 flex flex-col h-full z-50 md:z-auto
          transition-transform duration-200
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          top-0 md:top-auto pt-14 md:pt-0 border-r
        `}
        style={{ 
          backgroundColor: isDark ? '#111111' : '#ffffff',
          borderColor
        }}
      >
        {/* Logo */}
        <div className="hidden md:flex items-center justify-between px-4 h-14 border-b" style={{ borderColor }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">👁️‍🗨️</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: textPrimary }}>
              discuss.watch
            </span>
          </div>
          <button onClick={onToggleTheme} className="p-1.5 rounded-md transition-colors" style={{ color: textMuted }}>
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
        
        {/* Nav */}
        <nav className="flex-1 px-2 py-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: isActive 
                        ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') 
                        : 'transparent',
                      color: isActive ? textPrimary : textMuted
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = isDark ? '#18181b' : 'rgba(0,0,0,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="ml-auto text-[11px]" style={{ color: textMuted }}>
                        {item.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Admin */}
        {userIsAdmin && (
          <div className="px-2 pb-2">
            <a href="/admin"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={{ color: textMuted }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? '#18181b' : 'rgba(0,0,0,0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </a>
          </div>
        )}

        {/* User */}
        <div className="px-3 py-3 border-t" style={{ borderColor }}>
          <UserButton />
        </div>
      </aside>
    </>
  );
}
