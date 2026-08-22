'use client';

import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import type { ReactNode, CSSProperties } from 'react';

type LinkVariant = 'primary' | 'secondary' | 'ghost';

const LINK_VARIANT: Record<LinkVariant, CSSProperties> = {
  primary:   { background: 'var(--ds-fg)',      color: 'var(--ds-bg-base)', borderColor: 'var(--ds-fg)' },
  secondary: { background: 'var(--ds-bg-elev)', color: 'var(--ds-fg)',      borderColor: 'var(--ds-border)' },
  ghost:     { background: 'transparent',       color: 'var(--ds-fg)',      borderColor: 'transparent' },
};

export function MarketingLink({
  href,
  variant = 'primary',
  size = 'md',
  children,
  className,
}: {
  href: string;
  variant?: LinkVariant;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}) {
  const padding = size === 'lg' ? '10px 18px' : size === 'sm' ? '4px 10px' : '6px 14px';
  const fontSize = size === 'lg' ? 'var(--ds-text-base)' : size === 'sm' ? 'var(--ds-text-xs)' : 'var(--ds-text-sm)';
  return (
    <Link
      href={href}
      className={className ? `ds-btn ${className}` : 'ds-btn'}
      data-variant={variant}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 'var(--ds-radius-md)',
        fontWeight: 500,
        fontFamily: 'var(--ds-font-sans)',
        border: '1px solid',
        lineHeight: 1.2,
        padding,
        fontSize,
        ...LINK_VARIANT[variant],
      }}
    >
      {children}
    </Link>
  );
}

function Wordmark({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <Link href="/" className="flex items-center gap-2" style={{ color: 'var(--ds-fg)' }}>
      <span className={size === 'md' ? 'text-xl' : 'text-lg'} aria-hidden>👁️‍🗨️</span>
      <span
        className="font-semibold tracking-tight"
        style={{ fontSize: size === 'md' ? 'var(--ds-text-base)' : 'var(--ds-text-sm)' }}
      >
        discuss.watch
      </span>
    </Link>
  );
}

const NAV = [
  { href: '/#coverage', label: 'Coverage' },
  { href: '/governance', label: 'Governance' },
  { href: '/api/v1', label: 'API' },
];

export function MarketingChrome({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: 'var(--ds-bg-base)',
        color: 'var(--ds-fg)',
        fontFamily: 'var(--ds-font-sans)',
      }}
    >
      <nav
        className="sticky top-0 z-50"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--ds-bg-base) 88%, transparent)',
          borderBottom: '1px solid var(--ds-border)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-8">
            <Wordmark />
            <div className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 transition-colors"
                  style={{
                    color: 'var(--ds-fg-muted)',
                    fontSize: 'var(--ds-text-sm)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--ds-bg-elev)';
                    e.currentTarget.style.color = 'var(--ds-fg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--ds-fg-muted)';
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ padding: 6 }}
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </Button>
            <MarketingLink href="/app" variant="primary" size="sm">
              Open App
            </MarketingLink>
          </div>
        </div>
      </nav>

      <div className="flex-1">{children}</div>

      <footer style={{ borderTop: '1px solid var(--ds-border)' }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <p style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-sm)' }}>
            Part of the{' '}
            <a
              href="https://sovereignsignal.substack.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80"
              style={{ color: 'var(--ds-fg-muted)' }}
            >
              Sovereign Signal
            </a>{' '}
            ecosystem
          </p>
          <div className="flex items-center gap-3" style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-xs)' }}>
            <Link href="/terms" className="hover:underline underline-offset-2">Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:underline underline-offset-2">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
