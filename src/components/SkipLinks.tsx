'use client';

/**
 * Skip links for keyboard accessibility
 * These links appear when focused and allow keyboard users to skip to main content
 */
export function SkipLinks() {
  return (
    <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <ul className="fixed top-0 left-0 z-[100] flex gap-2 p-2 bg-gray-900">
        <li>
          <a
            href="#main-content"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            Skip to main content
          </a>
        </li>
        <li>
          <a
            href="#search"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            Skip to search
          </a>
        </li>
        <li>
          <a
            href="#navigation"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            Skip to navigation
          </a>
        </li>
      </ul>
    </nav>
  );
}
