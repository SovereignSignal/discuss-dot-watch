'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ChipVariant = 'solid' | 'outline' | 'dashed' | 'accent';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Active chips get filled background + accent border. */
  active?: boolean;
  variant?: ChipVariant;
  /** Vertical accent — if set, active state uses that vertical's color. */
  vertical?: 'crypto' | 'ai' | 'oss';
}

/**
 * Filter chip / tag. Used by:
 *   - Saved view folder filters
 *   - Contributors tier/wallet filters
 *   - Sticky alerts strip
 *   - Group-by toggles
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ active, variant = 'solid', vertical, style, children, ...rest }, ref) => {
    const activeAccent =
      vertical === 'crypto' ? 'var(--ds-ticker-crypto-fg)' :
      vertical === 'ai'     ? 'var(--ds-ticker-ai-fg)' :
      vertical === 'oss'    ? 'var(--ds-ticker-oss-fg)' :
      'var(--ds-fg)';

    const activeBg =
      vertical === 'crypto' ? 'var(--ds-ticker-crypto-bg)' :
      vertical === 'ai'     ? 'var(--ds-ticker-ai-bg)' :
      vertical === 'oss'    ? 'var(--ds-ticker-oss-bg)' :
      'var(--ds-bg-elev)';

    let bg: string = 'var(--ds-bg-elev)';
    let color: string = 'var(--ds-fg)';
    let borderStyle: 'solid' | 'dashed' = 'solid';
    let borderColor: string = 'var(--ds-border)';

    if (variant === 'dashed') {
      bg = 'transparent';
      color = 'var(--ds-fg-dim)';
      borderStyle = 'dashed';
      borderColor = 'var(--ds-border)';
    } else if (variant === 'outline') {
      bg = 'transparent';
      borderColor = 'var(--ds-border)';
    } else if (variant === 'accent') {
      bg = activeBg;
      color = activeAccent;
      borderColor = activeAccent;
    }

    if (active) {
      bg = activeBg;
      color = activeAccent;
      borderColor = activeAccent;
    }

    return (
      <button
        ref={ref}
        {...rest}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 'var(--ds-radius-full)',
          fontSize: 'var(--ds-text-xs)',
          fontWeight: 500,
          fontFamily: 'var(--ds-font-sans)',
          cursor: 'pointer',
          lineHeight: 1.3,
          background: bg,
          color,
          border: `1px ${borderStyle} ${borderColor}`,
          ...style,
        }}
      >
        {children}
      </button>
    );
  },
);
Chip.displayName = 'Chip';
