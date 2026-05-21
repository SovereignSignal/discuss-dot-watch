'use client';

import { ReactNode } from 'react';

export interface SectionHeaderProps {
  children: ReactNode;
  /** Optional right-aligned slot (e.g. a count or a meta line). */
  rightSlot?: ReactNode;
  /** Optional meta text shown after the title (smaller, mono). */
  meta?: ReactNode;
  className?: string;
}

/**
 * Small uppercase 11px section header — the recurring rhythm in the design.
 *
 * Usage:
 *   <SectionHeader>Trending</SectionHeader>
 *   <SectionHeader meta="refreshed 5m ago">Brief</SectionHeader>
 *   <SectionHeader rightSlot={<a>View all →</a>}>Saved</SectionHeader>
 */
export function SectionHeader({ children, rightSlot, meta, className }: SectionHeaderProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          fontSize: 'var(--ds-text-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--ds-fg-dim)',
          fontWeight: 600,
        }}
      >
        {children}
      </span>
      {meta && (
        <span style={{ fontFamily: 'var(--ds-font-mono)', fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)' }}>
          {meta}
        </span>
      )}
      {rightSlot && <div style={{ marginLeft: 'auto' }}>{rightSlot}</div>}
    </div>
  );
}
