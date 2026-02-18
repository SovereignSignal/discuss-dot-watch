'use client';

import { Bookmark } from '@/types';
import { Bookmark as BookmarkIcon, ExternalLink, Trash2 } from 'lucide-react';
import { c } from '@/lib/theme';

interface SavedViewProps {
  bookmarks: Bookmark[];
  onRemoveBookmark: (topicRefId: string) => void;
  isDark: boolean;
}

export function SavedView({ bookmarks, onRemoveBookmark, isDark }: SavedViewProps) {
  const t = c(isDark);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2
        className="text-xl font-semibold mb-6 flex items-center gap-2"
        style={{ color: t.fg }}
      >
        <BookmarkIcon className="w-5 h-5" />
        Saved Discussions
      </h2>
      {bookmarks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13px] mb-1" style={{ color: t.fgDim }}>
            No saved discussions yet
          </p>
          <p className="text-[12px]" style={{ color: t.fgMuted }}>
            Click the bookmark icon on any discussion to save it
          </p>
        </div>
      ) : (
        <div>
          {bookmarks.map((bookmark) => (
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
