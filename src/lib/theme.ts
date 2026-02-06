/**
 * Theme utilities for discuss.watch
 * 
 * Use CSS variables from globals.css instead of inline conditionals.
 * Components should use these tokens for consistent theming.
 */

// CSS variable references - use these in inline styles
export const theme = {
  // Backgrounds
  bg: 'var(--background)',
  cardBg: 'var(--card-bg)',
  cardBgSolid: 'var(--card-bg-solid)',
  sidebarBg: 'var(--sidebar-bg)',
  
  // Text
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  
  // Borders
  border: 'var(--card-border)',
  
  // Accent
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  
  // Status
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
} as const;

// For components that need actual color values (e.g., for calculations)
// These match the CSS variables in globals.css
export const colors = {
  dark: {
    bg: '#09090b',
    cardBg: '#18181b',
    text: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#52525b',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSolid: '#27272a',
    hover: 'rgba(255, 255, 255, 0.06)',
  },
  light: {
    bg: '#f8f9fa',
    cardBg: '#ffffff',
    text: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#6b7280',
    border: '#e2e4e9',
    borderSolid: '#e2e4e9',
    hover: 'rgba(0, 0, 0, 0.04)',
  },
} as const;

// Helper to get theme-aware styles
export function getThemeColors(isDark: boolean) {
  return isDark ? colors.dark : colors.light;
}

// Common style patterns
export const patterns = {
  card: (isDark: boolean) => ({
    backgroundColor: isDark ? colors.dark.cardBg : colors.light.cardBg,
    border: `1px solid ${isDark ? colors.dark.borderSolid : colors.light.border}`,
  }),
  
  cardHover: (isDark: boolean) => ({
    backgroundColor: isDark ? colors.dark.hover : colors.light.hover,
  }),
  
  text: (isDark: boolean) => ({
    color: isDark ? colors.dark.text : colors.light.text,
  }),
  
  textSecondary: (isDark: boolean) => ({
    color: isDark ? colors.dark.textSecondary : colors.light.textSecondary,
  }),
  
  textMuted: (isDark: boolean) => ({
    color: isDark ? colors.dark.textMuted : colors.light.textMuted,
  }),
  
  input: (isDark: boolean) => ({
    backgroundColor: isDark ? colors.dark.cardBg : colors.light.cardBg,
    border: `1px solid ${isDark ? colors.dark.borderSolid : colors.light.border}`,
    color: isDark ? colors.dark.text : colors.light.text,
  }),
  
  // Primary button (inverted colors)
  buttonPrimary: (isDark: boolean) => ({
    backgroundColor: isDark ? colors.dark.text : colors.light.text,
    color: isDark ? colors.dark.bg : colors.light.bg,
  }),
  
  // Secondary/ghost button
  buttonSecondary: (isDark: boolean) => ({
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    color: isDark ? colors.dark.textSecondary : colors.light.textSecondary,
  }),
} as const;
