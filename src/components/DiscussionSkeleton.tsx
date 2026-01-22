'use client';

export function DiscussionSkeleton() {
  return (
    <div className="p-4 border-b border-gray-800 animate-pulse" aria-hidden="true">
      <div className="flex items-start gap-3">
        {/* Avatar skeleton */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700" />

        <div className="flex-1 min-w-0">
          {/* Meta info skeleton */}
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-16 bg-gray-700 rounded" />
            <div className="h-3 w-2 bg-gray-700 rounded" />
            <div className="h-3 w-20 bg-gray-700 rounded" />
          </div>

          {/* Title skeleton */}
          <div className="h-5 w-full bg-gray-700 rounded mb-2" />
          <div className="h-5 w-2/3 bg-gray-700 rounded mb-3" />

          {/* Stats skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-3 w-12 bg-gray-700 rounded" />
            <div className="h-3 w-12 bg-gray-700 rounded" />
            <div className="h-3 w-12 bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiscussionSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading discussions">
      <span className="sr-only">Loading discussions...</span>
      {Array.from({ length: count }).map((_, i) => (
        <DiscussionSkeleton key={i} />
      ))}
    </div>
  );
}
