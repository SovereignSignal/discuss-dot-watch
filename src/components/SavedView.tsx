'use client';

import { useMemo, useState } from 'react';
import { Bookmark } from '@/types';
import { Bookmark as BookmarkIcon, ExternalLink, Trash2, Search } from 'lucide-react';
import { c } from '@/lib/theme';

type SortMode = 'recent' | 'oldest' | 'alphabetical' | 'forum';

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recently saved',
  oldest: 'Oldest first',
  alphabetical: 'Alphabetical',
  forum: 'By forum',
};

interface SavedViewProps {
  bookmarks: Bookmark[];
  onRemoveBookmark: (topicRefId: string) => void;
  isDark: boolean;
}

export function SavedView({ bookmarks, onRemoveBookmark, isDark }: SavedViewProps) {
  const t = c(isDark);
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const visibleBookmarks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? bookmarks.filter(
          (b) =>
            b.topicTitle.toLowerCase().includes(q) ||
            b.protocol.toLowerCase().includes(q),
        )
      : bookmarks.slice();
    const sorted = filtered.slice();
    sorted.sort((a, b) => {
      switch (sortMode) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'alphabetical':
          return a.topicTitle.localeCompare(b.topicTitle);
        case 'forum':
          return a.protocol.localeCompare(b.protocol) || a.topicTitle.localeCompare(b.topicTitle);
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [bookmarks, query, sortMode]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2
        className="text-xl font-semibold mb-4 flex items-center gap-2"
        style={{ color: t.fg }}
      >
        <BookmarkIcon className="w-5 h-5" />
        Saved Discussions
        <span className="text-[12px] font-normal" style={{ color: t.fgDim }}>
          {bookmarks.length}
        </span>
      </h2>

      {bookmarks.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: t.fgDim }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saved..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: t.bgCard,
                border: `1px solid ${t.border}`,
                color: t.fg,
                outline: 'none',
              }}
            />
          </div>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-lg text-sm px-3 py-2"
            style={{
              backgroundColor: t.bgCard,
              border: `1px solid ${t.border}`,
              color: t.fg,
              outline: 'none',
            }}
            aria-label="Sort saved discussions"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </option>
            ))}
          </select>
        </div>
      )}

      {bookmarks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13px] mb-1" style={{ color: t.fgDim }}>
            No saved discussions yet
          </p>
          <p className="text-[12px]" style={{ color: t.fgMuted }}>
            Click the bookmark icon on any discussion to save it
          </p>
        </div>
      ) : visibleBookmarks.length === 0 ? (
        <div className="text-center py-12 text-[13px]" style={{ color: t.fgDim }}>
          No saved discussions match &ldquo;{query}&rdquo;
        </div>
      ) : (
        <div>
          {visibleBookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="group flex items-center justify-between py-3 border-b transition-colors"
              style={{ borderColor: t.borderSubtle }}
            >
              <div className="flex-1 min-w-0">
                <a
                  href={bookmark.topicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-medium line-clamp-1 transition-opacity hover:opacity-70"
                  style={{ color: t.fgSecondary }}
                >
                  {bookmark.topicTitle}
                </a>
                <p className="text-[12px] mt-0.5" style={{ color: t.fgMuted }}>
                  {bookmark.protocol} · {new Date(bookmark.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={bookmark.topicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md"
                  style={{ color: t.fgMuted }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => onRemoveBookmark(bookmark.topicRefId)}
                  className="p-1.5 rounded-md hover:text-red-500 transition-colors"
                  style={{ color: t.fgMuted }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
