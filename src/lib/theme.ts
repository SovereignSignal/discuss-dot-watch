/**
 * Theme utilities for discuss.watch
 * 
 * Single source of truth for all colors. Components import `c(isDark)` and use the result.
 */

export const colors = {
  dark: {
    // Text
    fg: '#fafafa',
    fgSecondary: '#e4e4e7',
    fgMuted: '#a1a1aa',
    fgDim: '#71717a',
    
    // Backgrounds
    bg: '#09090b',
    bgSidebar: '#111111',
    bgCard: '#18181b',
    bgCardHover: '#1f1f23',
    bgInput: '#18181b',
    bgActive: 'rgba(255,255,255,0.08)',
    bgActiveStrong: 'rgba(255,255,255,0.1)',
    bgSubtle: 'rgba(255,255,255,0.04)',
    bgBadge: '#1f1f23',
    
    // Borders
    border: '#27272a',
    borderSubtle: 'rgba(255,255,255,0.08)',
    borderActive: 'rgba(255,255,255,0.15)',
    
    // Hover states
    hoverBg: '#18181b',
    hoverBorder: '#333333',
    
    // Read state
    readFg: 'rgba(250,250,250,0.4)',
    readBorder: 'rgba(255,255,255,0.03)',
  },
  light: {
    // Text
    fg: '#09090b',
    fgSecondary: '#3f3f46',
    fgMuted: '#4b5563',
    fgDim: '#6b7280',
    
    // Backgrounds
    bg: '#f8f9fa',
    bgSidebar: '#ffffff',
    bgCard: '#ffffff',
    bgCardHover: '#f5f5f5',
    bgInput: 'rgba(0,0,0,0.03)',
    bgActive: 'rgba(0,0,0,0.06)',
    bgActiveStrong: 'rgba(0,0,0,0.08)',
    bgSubtle: 'rgba(0,0,0,0.02)',
    bgBadge: 'rgba(0,0,0,0.05)',
    
    // Borders
    border: 'rgba(0,0,0,0.08)',
    borderSubtle: 'rgba(0,0,0,0.06)',
    borderActive: 'rgba(0,0,0,0.15)',
    
    // Hover states
    hoverBg: 'rgba(0,0,0,0.02)',
    hoverBorder: 'rgba(0,0,0,0.12)',
    
    // Read state
    readFg: 'rgba(9,9,11,0.4)',
    readBorder: 'rgba(0,0,0,0.03)',
  },
} as const;

/** Get theme colors for current mode */
export function c(isDark: boolean) {
  return isDark ? colors.dark : colors.light;
}

/** CSS variable references for components that can use them */
export const cssVars = {
  bg: 'var(--background)',
  cardBg: 'var(--card-bg)',
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  border: 'var(--card-border)',
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
} as const;
