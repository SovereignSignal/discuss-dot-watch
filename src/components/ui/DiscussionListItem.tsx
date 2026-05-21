'use client';

import { ReactNode } from 'react';
import { TickerBadge, Vertical } from './TickerBadge';

export interface DiscussionListItemProps {
  /** Required forum ticker shown as a colored badge. */
  ticker: string;
  /** Per-vertical accent for the ticker. */
  vertical?: Vertical;
  /** Full forum display name (e.g. "Uniswap"). Shown in standard/cozy density. */
  forumName?: string;
  /** Relative time string (e.g. "12m", "1h", "2d"). */
  when: string;
  /** Discussion title. */
  title: string;
  /** Excerpt — shown in standard (1 line) and cozy (2 lines). Hidden in compact. */
  excerpt?: string;
  /** Inline meta stats. */
  stats?: {
    replies?: number;
    views?: number;
    likes?: number;
    /** "Hot" / "Active" / etc. badge text — wins over numeric stats visually. */
    activity?: 'hot' | 'active' | null;
  };
  /** Render in muted style (50% opacity). */
  isRead?: boolean;
  /** Render with active background. */
  isSelected?: boolean;
  /** Click handler — turns row into a clickable button. */
  onClick?: () => void;
  /** Right-side slot (e.g. bookmark button). Stays visible on row hover. */
  rightSlot?: ReactNode;
  className?: string;
}

const ACTIVITY_COLOR = {
  hot:    { fg: 'var(--ds-warn)',  label: 'hot'    },
  active: { fg: 'var(--ds-info)',  label: 'active' },
} as const;

function formatCount(n?: number): string {
  if (n == null) return '';
  if (n >= 1000) {
    const k = n / 1000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

/**
 * Density-aware discussion list row.
 *
 * Reads CSS variables that vary by `<html data-density="...">`:
 *   --ds-density-item-py        padding-y
 *   --ds-density-item-px        padding-x
 *   --ds-density-item-title     title font-size
 *   --ds-density-item-excerpt-lines  webkit-line-clamp on excerpt
 *   --ds-density-show-excerpt   "0" = hidden, "1" = shown (via opacity hack)
 *
 * The same component renders all three densities without prop changes —
 * density toggle in the app shell cascades automatically.
 */
export function DiscussionListItem({
  ticker,
  vertical = 'neutral',
  forumName,
  when,
  title,
  excerpt,
  stats,
  isRead,
  isSelected,
  onClick,
  rightSlot,
  className,
}: DiscussionListItemProps) {
  const activity = stats?.activity ? ACTIVITY_COLOR[stats.activity] : null;
  const interactive = !!onClick;

  return (
    <div
      onClick={onClick}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
      } : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-selected={isSelected}
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 'var(--ds-density-item-py, 12px) var(--ds-density-item-px, 16px)',
        background: isSelected ? 'var(--ds-bg-elev)' : 'transparent',
        opacity: isRead ? 0.5 : 1,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
      onMouseEnter={interactive ? (e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--ds-bg-card)';
      } : undefined}
      onMouseLeave={interactive ? (e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      } : undefined}
    >
      {/* Top row: ticker + when (+ rightSlot floats right) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <TickerBadge vertical={vertical}>{ticker}</TickerBadge>
        {forumName && (
          <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)' }}>
            {forumName} · {when}
          </span>
        )}
        {!forumName && (
          <span style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)' }}>{when}</span>
        )}
        {rightSlot && (
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{rightSlot}</div>
        )}
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 'var(--ds-density-item-title, 0.9375rem)',
          fontWeight: 600,
          color: 'var(--ds-fg)',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </div>

      {/* Excerpt — clamp lines via CSS var, hide entirely in compact mode */}
      {excerpt && (
        <div
          style={{
            fontSize: 'var(--ds-text-sm)',
            color: 'var(--ds-fg-muted)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 'var(--ds-density-item-excerpt-lines, 1)' as unknown as number,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
            // density="compact" sets --ds-density-show-excerpt: 0 → render nothing
            height: 'calc(var(--ds-density-show-excerpt, 1) * auto)',
            visibility: 'visible',
          }}
        >
          {excerpt}
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {stats.replies != null && <span>{formatCount(stats.replies)} r</span>}
          {stats.views != null && <span>{formatCount(stats.views)} v</span>}
          {stats.likes != null && stats.likes > 0 && <span>{formatCount(stats.likes)} l</span>}
          {activity && (
            <span style={{ color: activity.fg, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              ● {activity.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
