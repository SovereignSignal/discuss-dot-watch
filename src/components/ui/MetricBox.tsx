'use client';

import { ReactNode } from 'react';

export interface MetricBoxProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Color of the value text. Defaults to neutral fg. */
  color?: 'fg' | 'success' | 'warn' | 'error' | 'info' | string;
  className?: string;
}

function resolveColor(c: MetricBoxProps['color']): string {
  switch (c) {
    case 'success': return 'var(--ds-success)';
    case 'warn':    return 'var(--ds-warn)';
    case 'error':   return 'var(--ds-error)';
    case 'info':    return 'var(--ds-info)';
    case 'fg':
    case undefined: return 'var(--ds-fg)';
    default:        return c; // raw color string passthrough
  }
}

/**
 * Compact metric tile — used in tenant dashboard health bars and
 * verified delegate program cards. Value is fixed at text-xl with
 * tabular-nums for numeric alignment.
 */
export function MetricBox({ label, value, sub, color, className }: MetricBoxProps) {
  return (
    <div
      className={className}
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--ds-radius-lg)',
        background: 'var(--ds-bg-elev)',
        border: `1px solid var(--ds-border)`,
      }}
    >
      <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)', marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 'var(--ds-text-xl)',
          fontWeight: 700,
          color: resolveColor(color),
          fontFamily: 'var(--ds-font-mono)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--ds-text-xs)', color: 'var(--ds-fg-dim)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}
