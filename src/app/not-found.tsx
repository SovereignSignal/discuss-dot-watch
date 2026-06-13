import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--ds-bg-base)', color: 'var(--ds-fg)' }}
    >
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="mb-8" style={{ color: 'var(--ds-fg-dim)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--ds-fg)', color: 'var(--ds-bg-base)' }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
