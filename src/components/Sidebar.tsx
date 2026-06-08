'use client';

import Link from 'next/link';
import { LayoutGrid, FolderOpen, Settings, Bookmark, Sun, Moon, Menu, X, Shield, Newspaper, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { UserButton } from './UserButton';
import { useTenantRoles } from '@/hooks/useTenantRoles';

type Density = 'compact' | 'standard' | 'cozy';

interface SidebarProps {
  activeView: 'feed' | 'briefs' | 'projects' | 'saved' | 'settings';
  onViewChange: (view: 'feed' | 'briefs' | 'projects' | 'saved' | 'settings') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  density?: Density;
  onSetDensity?: (d: Density) => void;
  savedCount?: number;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
}

export function Sidebar({ activeView, onViewChange, theme, onToggleTheme, density = 'standard', onSetDensity, savedCount = 0, isMobileOpen, onMobileToggle }: SidebarProps) {
  const isDark = theme === 'dark';
  const { isSuperAdmin } = useTenantRoles();
  
  // View-toggle items have no href; an href makes the item a route link (e.g. the
  // standalone /governance terminal, which lives outside the /app SPA).
  const navItems: Array<{ id: typeof activeView | 'governance'; label: string; icon: LucideIcon; count?: number; href?: string }> = [
    { id: 'feed', label: 'Feed', icon: LayoutGrid },
    { id: 'briefs', label: 'Briefs', icon: Newspaper },
    { id: 'projects', label: 'Communities', icon: FolderOpen },
    { id: 'governance', label: 'Governance', icon: Landmark, href: '/governance' },
    { id: 'saved', label: 'Saved', icon: Bookmark, count: savedCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (view: typeof activeView) => {
    onViewChange(view);
    if (isMobileOpen) onMobileToggle();
  };

  return (
    <>
      {/* Mobile Header */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--ds-bg-base)', borderBottom: `1px solid var(--ds-border)` }}
      >
        <button onClick={onMobileToggle} className="p-2 -ml-2" style={{ color: 'var(--ds-fg)' }}>
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">👁️‍🗨️</span>
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--ds-fg)' }}>discuss.watch</span>
        </div>
        <button onClick={onToggleTheme} className="p-2 -mr-2" style={{ color: 'var(--ds-fg-muted)' }}>
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
          top-0 md:top-auto pt-14 md:pt-0
        `}
        style={{ background: 'var(--ds-bg-base)', borderRight: `1px solid var(--ds-border)` }}
      >
        {/* Logo */}
        <div className="hidden md:flex items-center justify-between px-4 h-14" style={{ borderBottom: `1px solid var(--ds-border)` }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">👁️‍🗨️</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--ds-fg)' }}>
              discuss.watch
            </span>
          </div>
          <button onClick={onToggleTheme} className="p-1.5 rounded-md transition-colors" style={{ color: 'var(--ds-fg-muted)' }}>
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              const cls = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors';
              const style = {
                background: isActive ? 'var(--ds-bg-elev)' : 'transparent',
                color: isActive ? 'var(--ds-fg)' : 'var(--ds-fg-muted)',
                fontSize: 'var(--ds-text-sm)',
                fontFamily: 'var(--ds-font-sans)',
              };
              const onEnter = (e: MouseEvent<HTMLElement>) => { if (!isActive) e.currentTarget.style.background = 'var(--ds-bg-elev)'; };
              const onLeave = (e: MouseEvent<HTMLElement>) => { if (!isActive) e.currentTarget.style.background = 'transparent'; };
              const inner = (
                <>
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)', fontFamily: 'var(--ds-font-mono)' }}>
                      {item.count}
                    </span>
                  )}
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link href={item.href} onClick={() => { if (isMobileOpen) onMobileToggle(); }} className={cls} style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                      {inner}
                    </Link>
                  ) : (
                    <button onClick={() => handleNavClick(item.id as typeof activeView)} className={cls} style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Admin */}
        {isSuperAdmin && (
          <div className="px-2 pb-2">
            <Link href="/admin"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium transition-colors"
              style={{ color: 'var(--ds-fg-muted)', fontSize: 'var(--ds-text-sm)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ds-bg-elev)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          </div>
        )}

        {/* Density toggle */}
        {onSetDensity && (
          <div className="px-3 py-2" style={{ borderTop: `1px solid var(--ds-border)` }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-fg-dim)' }}>
                Density
              </span>
              <div className="inline-flex rounded-md p-0.5" style={{ background: 'var(--ds-bg-elev)', border: `1px solid var(--ds-border)` }}>
                {(['compact', 'standard', 'cozy'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => onSetDensity(d)}
                    className="px-1.5 py-1 text-[10px] font-medium rounded transition-colors"
                    style={{
                      background: density === d ? 'var(--ds-bg-subtle)' : 'transparent',
                      color: density === d ? 'var(--ds-fg)' : 'var(--ds-fg-muted)',
                    }}
                    title={d.charAt(0).toUpperCase() + d.slice(1)}
                  >
                    {d === 'compact' ? '≡' : d === 'standard' ? '▤' : '☰'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User */}
        <div className="px-3 py-3" style={{ borderTop: `1px solid var(--ds-border)` }}>
          <UserButton />
        </div>
      </aside>
    </>
  );
}
