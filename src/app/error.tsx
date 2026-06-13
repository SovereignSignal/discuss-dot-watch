'use client';

import Link from 'next/link';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--ds-bg-base)', color: 'var(--ds-fg)' }}
    >
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="mb-8" style={{ color: 'var(--ds-fg-dim)' }}>
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--ds-fg)', color: 'var(--ds-bg-base)' }}
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ border: '1px solid var(--ds-border)', color: 'var(--ds-fg-muted)' }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
