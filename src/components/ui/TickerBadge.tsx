'use client';

import { CSSProperties, ReactNode } from 'react';

export type Vertical = 'crypto' | 'ai' | 'oss' | 'neutral';

export interface TickerBadgeProps {
  /** Per-vertical accent. "neutral" uses fg-muted tones (no category color). */
  vertical?: Vertical;
  /** Size — sm (default) is for inline use, md is for headers/leaderboards. */
  size?: 'sm' | 'md';
  /** Optional title attribute (tooltip). */
  title?: string;
  className?: string;
  children: ReactNode;
}

const VARIANT: Record<Vertical, { fg: string; bg: string; border: string }> = {
  crypto:  { fg: 'var(--ds-ticker-crypto-fg)', bg: 'var(--ds-ticker-crypto-bg)', border: 'var(--ds-ticker-crypto-border)' },
  ai:      { fg: 'var(--ds-ticker-ai-fg)',     bg: 'var(--ds-ticker-ai-bg)',     border: 'var(--ds-ticker-ai-border)'     },
  oss:     { fg: 'var(--ds-ticker-oss-fg)',    bg: 'var(--ds-ticker-oss-bg)',    border: 'var(--ds-ticker-oss-border)'    },
  neutral: { fg: 'var(--ds-fg-muted)',         bg: 'var(--ds-bg-elev)',          border: 'var(--ds-border)'                },
};

const SIZE: Record<'sm' | 'md', CSSProperties> = {
  sm: { fontSize: 'var(--ds-text-xs)', padding: '1px 6px' },
  md: { fontSize: 'var(--ds-text-sm)', padding: '2px 8px' },
};

/**
 * Monospace per-vertical ticker badge.
 * Reads --ds-ticker-{vertical}-* tokens; auto-adjusts for theme.
 */
export function TickerBadge({
  vertical = 'neutral',
  size = 'sm',
  title,
  className,
  children,
}: TickerBadgeProps) {
  const v = VARIANT[vertical];
  return (
    <span
      title={title}
      className={className}
      style={{
        ...SIZE[size],
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--ds-font-mono)',
        fontWeight: 500,
        color: v.fg,
        background: v.bg,
        border: `1px solid ${v.border}`,
        borderRadius: 'var(--ds-radius-sm)',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  );
}
