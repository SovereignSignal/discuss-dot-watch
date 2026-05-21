'use client';

import { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Trims vertical padding for inline (in-card) usage. */
  compact?: boolean;
}

/**
 * Consistent empty-state pattern: optional icon, title, body, optional action.
 * Used by Saved (no bookmarks), Feed (no forums), Briefs (cache cold),
 * Contributors (no rows match filter), etc.
 */
export function EmptyState({ icon, title, body, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: compact ? '24px 16px' : '64px 24px',
        gap: 8,
      }}
    >
      {icon && (
        <div
          style={{
            color: 'var(--ds-fg-dim)',
            marginBottom: 4,
            opacity: 0.7,
          }}
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: 'var(--ds-text-base)',
          fontWeight: 500,
          color: 'var(--ds-fg)',
        }}
      >
        {title}
      </div>
      {body && (
        <div
          style={{
            fontSize: 'var(--ds-text-sm)',
            color: 'var(--ds-fg-muted)',
            maxWidth: 400,
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
