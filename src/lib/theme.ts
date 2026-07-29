/**
 * Legacy compatibility adapter. The palette now resolves entirely through the
 * design-system CSS variables, so callers inherit the SSR-selected theme and
 * density without branching in JavaScript.
 */
const tokenColors = {
  fg: 'var(--ds-fg)',
  fgSecondary: 'var(--ds-fg-muted)',
  fgMuted: 'var(--ds-fg-muted)',
  fgDim: 'var(--ds-fg-dim)',
  bg: 'var(--ds-bg-base)',
  bgSidebar: 'var(--ds-bg-card)',
  bgCard: 'var(--ds-bg-card)',
  bgCardHover: 'var(--ds-bg-elev)',
  bgInput: 'var(--ds-bg-elev)',
  bgActive: 'var(--ds-bg-subtle)',
  bgActiveStrong: 'var(--ds-bg-elev)',
  bgSubtle: 'var(--ds-bg-subtle)',
  bgBadge: 'var(--ds-bg-elev)',
  border: 'var(--ds-border)',
  borderSubtle: 'var(--ds-border-subtle)',
  borderActive: 'var(--ds-border-strong)',
  hoverBg: 'var(--ds-bg-elev)',
  hoverBorder: 'var(--ds-border-strong)',
  readFg: 'var(--ds-fg-dim)',
  readBorder: 'var(--ds-border-subtle)',
} as const;

/** @deprecated Prefer `var(--ds-*)` directly in new and touched components. */
export function c(_isDark?: boolean) {
  void _isDark;
  return tokenColors;
}

export const cssVars = {
  bg: 'var(--ds-bg-base)',
  cardBg: 'var(--ds-bg-card)',
  text: 'var(--ds-fg)',
  textSecondary: 'var(--ds-fg-muted)',
  textMuted: 'var(--ds-fg-dim)',
  border: 'var(--ds-border)',
  accent: 'var(--ds-info)',
  success: 'var(--ds-success)',
  warning: 'var(--ds-warn)',
  danger: 'var(--ds-error)',
  info: 'var(--ds-info)',
} as const;
