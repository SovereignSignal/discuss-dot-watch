'use client';

import Link from 'next/link';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200 px-6">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-zinc-500 mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
