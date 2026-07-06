'use client';

import { useMemo, useState } from 'react';
import { Bookmark } from '@/types';
import { Bookmark as BookmarkIcon, ExternalLink, Trash2, Search, FolderPlus, Folder, Inbox, Check, X } from 'lucide-react';

type SortMode = 'recent' | 'oldest' | 'alphabetical' | 'forum';

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recently saved',
  oldest: 'Oldest first',
  alphabetical: 'Alphabetical',
  forum: 'By forum',
};

const ALL_FOLDER = '__all__';
const UNFILED_FOLDER = '__unfiled__';

interface SavedViewProps {
  bookmarks: Bookmark[];
  onRemoveBookmark: (topicRefId: string) => void;
  onSetFolder?: (topicRefId: string, folder: string | null) => void;
  isDark: boolean;
}

export function SavedView({ bookmarks, onRemoveBookmark, onSetFolder, isDark }: SavedViewProps) {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [activeFolder, setActiveFolder] = useState<string>(ALL_FOLDER);
  const [folderPickerFor, setFolderPickerFor] = useState<string | null>(null);
  const [newFolderInput, setNewFolderInput] = useState('');

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookmarks) {
      const f = (b.folder || '').trim();
      if (f) set.add(f);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [bookmarks]);

  const unfiledCount = useMemo(
    () => bookmarks.filter((b) => !b.folder || !b.folder.trim()).length,
    [bookmarks],
  );

  const folderCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bookmarks) {
      const f = (b.folder || '').trim();
      if (!f) continue;
      m.set(f, (m.get(f) ?? 0) + 1);
    }
    return m;
  }, [bookmarks]);

  const visibleBookmarks = useMemo(() => {
    let pool = bookmarks;
    if (activeFolder === UNFILED_FOLDER) {
      pool = pool.filter((b) => !b.folder || !b.folder.trim());
    } else if (activeFolder !== ALL_FOLDER) {
      pool = pool.filter((b) => (b.folder || '').trim() === activeFolder);
    }
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pool.filter(
          (b) =>
            b.topicTitle.toLowerCase().includes(q) ||
            b.protocol.toLowerCase().includes(q) ||
            (b.folder || '').toLowerCase().includes(q),
        )
      : pool.slice();
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
  }, [bookmarks, activeFolder, query, sortMode]);

  const handleAssignFolder = (refId: string, folder: string | null) => {
    if (onSetFolder) onSetFolder(refId, folder);
    setFolderPickerFor(null);
    setNewFolderInput('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2
        className="text-xl font-semibold mb-4 flex items-center gap-2"
        style={{ color: 'var(--ds-fg)' }}
      >
        <BookmarkIcon className="w-5 h-5" />
        Saved Discussions
        <span className="text-[12px] font-normal" style={{ color: 'var(--ds-fg-dim)' }}>
          {bookmarks.length}
        </span>
      </h2>

      {bookmarks.length > 0 && (
        <>
          {/* Folder chips */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <FolderChip
              active={activeFolder === ALL_FOLDER}
              onClick={() => setActiveFolder(ALL_FOLDER)}
            >
              <Inbox className="w-3 h-3" />
              All <span className="opacity-60">({bookmarks.length})</span>
            </FolderChip>
            {unfiledCount > 0 && (
              <FolderChip
                active={activeFolder === UNFILED_FOLDER}
                onClick={() => setActiveFolder(UNFILED_FOLDER)}
              >
                Unfiled <span className="opacity-60">({unfiledCount})</span>
              </FolderChip>
            )}
            {folders.map((f) => (
              <FolderChip
                key={f}
                active={activeFolder === f}
                onClick={() => setActiveFolder(f)}
              >
                <Folder className="w-3 h-3" />
                {f} <span className="opacity-60">({folderCounts.get(f) ?? 0})</span>
              </FolderChip>
            ))}
          </div>

          {/* Search + sort */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--ds-fg-dim)' }} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search saved..."
                className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--ds-bg-card)',
                  border: `1px solid ${'var(--ds-border)'}`,
                  color: 'var(--ds-fg)',
                  outline: 'none',
                }}
              />
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg text-sm px-3 py-2"
              style={{
                backgroundColor: 'var(--ds-bg-card)',
                border: `1px solid ${'var(--ds-border)'}`,
                color: 'var(--ds-fg)',
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
        </>
      )}

      {bookmarks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13px] mb-1" style={{ color: 'var(--ds-fg-dim)' }}>
            No saved discussions yet
          </p>
          <p className="text-[12px]" style={{ color: 'var(--ds-fg-muted)' }}>
            Click the bookmark icon on any discussion to save it
          </p>
        </div>
      ) : visibleBookmarks.length === 0 ? (
        <div className="text-center py-12 text-[13px]" style={{ color: 'var(--ds-fg-dim)' }}>
          {query
            ? `No saved discussions match "${query}"`
            : activeFolder === UNFILED_FOLDER
              ? 'No unfiled bookmarks'
              : `No bookmarks in "${activeFolder}"`}
        </div>
      ) : (
        <div>
          {visibleBookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="group flex items-center justify-between py-3 border-b transition-colors"
              style={{ borderColor: 'var(--ds-border-subtle)' }}
            >
              <div className="flex-1 min-w-0">
                <a
                  href={bookmark.topicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-medium line-clamp-1 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--ds-fg)' /*was: 'var(--ds-fg)'Secondary*/ }}
                >
                  {bookmark.topicTitle}
                </a>
                <p className="text-[12px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--ds-fg-muted)' }}>
                  <span>{bookmark.protocol}</span>
                  <span>·</span>
                  <span>{new Date(bookmark.createdAt).toLocaleDateString()}</span>
                  {bookmark.folder && (
                    <>
                      <span>·</span>
                      <span style={{ color: 'var(--ds-fg)' /*was: 'var(--ds-fg)'Secondary*/, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Folder className="w-3 h-3" />
                        {bookmark.folder}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 hover-action">
                {onSetFolder && (
                  <button
                    onClick={() => setFolderPickerFor(folderPickerFor === bookmark.topicRefId ? null : bookmark.topicRefId)}
                    className="p-1.5 rounded-md hover:opacity-80 transition-colors"
                    style={{ color: 'var(--ds-fg-muted)' }}
                    title={bookmark.folder ? `Move from "${bookmark.folder}"` : 'Move to folder'}
                    aria-label="Move to folder"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                )}
                <a
                  href={bookmark.topicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md"
                  style={{ color: 'var(--ds-fg-muted)' }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => onRemoveBookmark(bookmark.topicRefId)}
                  className="p-1.5 rounded-md hover:text-red-500 transition-colors"
                  style={{ color: 'var(--ds-fg-muted)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Folder picker popover */}
      {folderPickerFor && onSetFolder && (
        <FolderPicker
          existingFolders={folders}
          currentFolder={bookmarks.find((b) => b.topicRefId === folderPickerFor)?.folder ?? null}
          newFolderInput={newFolderInput}
          onNewFolderInputChange={setNewFolderInput}
          onAssign={(folder) => handleAssignFolder(folderPickerFor, folder)}
          onClose={() => { setFolderPickerFor(null); setNewFolderInput(''); }}
          isDark={isDark}
        />
      )}
    </div>
  );
}

function FolderChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors flex items-center gap-1.5"
      style={{
        backgroundColor: active ? 'var(--ds-fg)' : 'var(--ds-bg-card)',
        color: active ? 'var(--ds-bg-base)' : 'var(--ds-fg-muted)',
        border: `1px solid ${active ? 'var(--ds-fg)' : 'var(--ds-border)'}`,
      }}
    >
      {children}
    </button>
  );
}

function FolderPicker({
  existingFolders,
  currentFolder,
  newFolderInput,
  onNewFolderInputChange,
  onAssign,
  onClose,
  isDark,
}: {
  existingFolders: string[];
  currentFolder: string | null;
  newFolderInput: string;
  onNewFolderInputChange: (v: string) => void;
  onAssign: (folder: string | null) => void;
  onClose: () => void;
  isDark: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-lg shadow-xl"
        style={{ backgroundColor: 'var(--ds-bg-card)', border: `1px solid ${'var(--ds-border)'}` }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--ds-border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--ds-fg)' }}>Move to folder</span>
          <button onClick={onClose} style={{ color: 'var(--ds-fg-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 max-h-72 overflow-y-auto">
          <button
            onClick={() => onAssign(null)}
            className="w-full flex items-center justify-between px-3 py-2 rounded text-sm text-left hover:opacity-80 transition-colors"
            style={{ color: 'var(--ds-fg)', backgroundColor: !currentFolder ? 'var(--ds-bg-elev)' : 'transparent' }}
          >
            <span className="flex items-center gap-2"><Inbox className="w-3.5 h-3.5" />Unfiled</span>
            {!currentFolder && <Check className="w-3.5 h-3.5" />}
          </button>
          {existingFolders.map((f) => (
            <button
              key={f}
              onClick={() => onAssign(f)}
              className="w-full flex items-center justify-between px-3 py-2 rounded text-sm text-left hover:opacity-80 transition-colors"
              style={{ color: 'var(--ds-fg)', backgroundColor: currentFolder === f ? 'var(--ds-bg-elev)' : 'transparent' }}
            >
              <span className="flex items-center gap-2"><Folder className="w-3.5 h-3.5" />{f}</span>
              {currentFolder === f && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = newFolderInput.trim();
            if (trimmed) onAssign(trimmed);
          }}
          className="flex items-center gap-2 px-3 py-3 border-t"
          style={{ borderColor: 'var(--ds-border)' }}
        >
          <FolderPlus className="w-4 h-4" style={{ color: 'var(--ds-fg-dim)' }} />
          <input
            type="text"
            value={newFolderInput}
            onChange={(e) => onNewFolderInputChange(e.target.value)}
            placeholder="New folder name..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--ds-fg)' }}
            maxLength={100}
            autoFocus
          />
          <button
            type="submit"
            disabled={!newFolderInput.trim()}
            className="text-xs font-medium px-2 py-1 rounded transition-opacity disabled:opacity-30"
            style={{ color: 'var(--ds-fg)', backgroundColor: 'var(--ds-bg-elev)' }}
          >
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
