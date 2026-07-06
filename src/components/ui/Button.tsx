'use client';

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary:   { background: 'var(--ds-fg)',      color: 'var(--ds-bg-base)', borderColor: 'var(--ds-fg)'      },
  secondary: { background: 'var(--ds-bg-elev)', color: 'var(--ds-fg)',      borderColor: 'var(--ds-border)'  },
  ghost:     { background: 'transparent',       color: 'var(--ds-fg)',      borderColor: 'transparent'       },
  danger:    { background: 'transparent',       color: 'var(--ds-error)',   borderColor: 'rgba(239,68,68,0.4)' },
};

const SIZE_STYLE: Record<ButtonSize, CSSProperties> = {
  sm: { fontSize: 'var(--ds-text-xs)', padding: '4px 10px' },
  md: { fontSize: 'var(--ds-text-sm)', padding: '6px 14px' },
};

/**
 * Primary, secondary, ghost, danger button variants.
 * Hover / active / focus-visible / disabled states come from the `.ds-btn`
 * rules in globals.css (inline styles can't express pseudo-states).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', fullWidth, style, className, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        {...rest}
        className={className ? `ds-btn ${className}` : 'ds-btn'}
        data-variant={variant}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 'var(--ds-radius-md)',
          fontWeight: 500,
          fontFamily: 'var(--ds-font-sans)',
          cursor: rest.disabled ? 'not-allowed' : 'pointer',
          border: '1px solid',
          lineHeight: 1.2,
          width: fullWidth ? '100%' : undefined,
          ...SIZE_STYLE[size],
          ...VARIANT_STYLE[variant],
          ...style,
        }}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
