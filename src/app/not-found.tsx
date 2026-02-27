import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200 px-6">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-zinc-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
