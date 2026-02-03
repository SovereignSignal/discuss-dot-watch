'use client';

import { useState, useMemo, memo } from 'react';
import { RefreshCw, Clock, CheckCircle, XCircle, Loader2, Trash2, CheckCheck } from 'lucide-react';
import { DiscussionTopic, KeywordAlert, DateRangeFilter, Forum, SortOption } from '@/types';
import { DiscussionItem } from './DiscussionItem';
import { DiscussionSkeletonList } from './DiscussionSkeleton';
import { FeedFilters } from './FeedFilters';
import { ForumLoadingState } from '@/hooks/useDiscussions';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';

const MemoizedDiscussionItem = memo(DiscussionItem);

interface DiscussionFeedProps {
  discussions: DiscussionTopic[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onRefresh: () => void;
  alerts: KeywordAlert[];
  searchQuery: string;
  enabledForumIds: string[];
  forumStates: ForumLoadingState[];
  forums: Forum[];
  isBookmarked: (refId: string) => boolean;
  isRead: (refId: string) => boolean;
  onToggleBookmark: (topic: DiscussionTopic) => void;
  onMarkAsRead: (refId: string) => void;
  onMarkAllAsRead: (refIds: string[]) => void;
  unreadCount: number;
  onRemoveForum?: (forumId: string) => void;
}

export function DiscussionFeed({
  discussions,
  isLoading,
  error: _error,
  lastUpdated,
  onRefresh,
  alerts,
  searchQuery,
  enabledForumIds,
  forumStates,
  forums,
  isBookmarked,
  isRead,
  onToggleBookmark,
  onMarkAsRead,
  onMarkAllAsRead,
  unreadCount,
  onRemoveForum,
}: DiscussionFeedProps) {
  const [displayCount, setDisplayCount] = useState(20);
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [selectedForumId, setSelectedForumId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // Create a lookup map for forum logos by cname
  const forumLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    forums.forEach((forum) => {
      if (forum.logoUrl) {
        map.set(forum.cname.toLowerCase(), forum.logoUrl);
      }
    });
    return map;
  }, [forums]);

  const filteredAndSortedDiscussions = useMemo(() => {
    // First filter
    const filtered = discussions.filter((topic) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          topic.title.toLowerCase().includes(query) ||
          topic.protocol.toLowerCase().includes(query) ||
          topic.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (dateRange !== 'all') {
        const topicDate = new Date(topic.bumpedAt);
        if (dateRange === 'today' && !isToday(topicDate)) return false;
        if (dateRange === 'week' && !isThisWeek(topicDate)) return false;
        if (dateRange === 'month' && !isThisMonth(topicDate)) return false;
      }

      // Forum source filter
      if (selectedForumId) {
        const forum = forums.find((f) => f.id === selectedForumId);
        if (forum && topic.protocol.toLowerCase() !== forum.cname.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    // Then sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'replies':
          return b.replyCount - a.replyCount;
        case 'views':
          return b.views - a.views;
        case 'likes':
          return b.likeCount - a.likeCount;
        case 'recent':
        default:
          return new Date(b.bumpedAt).getTime() - new Date(a.bumpedAt).getTime();
      }
    });
  }, [discussions, searchQuery, dateRange, selectedForumId, forums, sortBy]);

  const displayedDiscussions = filteredAndSortedDiscussions.slice(0, displayCount);
  const hasMore = displayCount < filteredAndSortedDiscussions.length;

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 20);
  };

  const handleMarkAllAsRead = () => {
    const visibleRefIds = displayedDiscussions.map((d) => d.refId);
    onMarkAllAsRead(visibleRefIds);
  };

  return (
    <section className="flex-1 flex flex-col theme-card" aria-label="Discussion feed">
      <header
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: 'var(--card-border)' }}
      >
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold theme-text">Discussions</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-medium rounded-full">
              {unreadCount} new
            </span>
          )}
          {lastUpdated && (
            <span className="flex items-center gap-1 text-xs theme-text-muted hidden sm:flex">
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span>Updated {format(lastUpdated, 'HH:mm:ss')}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-3 py-2 min-h-[44px] bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Mark all visible as read"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Mark read</span>
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            aria-label={isLoading ? 'Loading discussions' : 'Refresh discussions'}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      <FeedFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedForumId={selectedForumId}
        onForumFilterChange={setSelectedForumId}
        forums={forums.filter((f) => f.isEnabled)}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Show defunct forums with remove option */}
      {onRemoveForum && forumStates.some((s) => s.isDefunct) && (
        <div className="p-4 bg-amber-500/10 border-b border-amber-500/30" role="alert">
          <p className="text-amber-400 text-sm mb-2">Some forums have shut down or moved:</p>
          <div className="flex flex-wrap gap-2">
            {forumStates
              .filter((s) => s.isDefunct)
              .map((state) => (
                <span
                  key={state.forumId}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 rounded-lg text-xs text-amber-300"
                >
                  {state.forumName}
                  <button
                    onClick={() => onRemoveForum(state.forumId)}
                    className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center hover:bg-amber-500/30 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    aria-label={`Remove ${state.forumName}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}

      {isLoading && forumStates.length > 0 && (
        <div
          className="px-4 py-2 bg-neutral-800/50 border-b"
          style={{ borderColor: 'var(--card-border)' }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {(() => {
            const completed = forumStates.filter(s => s.status === 'success' || s.status === 'error').length;
            const total = forumStates.length;
            const failed = forumStates.filter(s => s.status === 'error').length;
            return (
              <p className="text-xs theme-text-muted mb-2">
                Loading forums: {completed} of {total} complete
                {failed > 0 && <span className="text-rose-400"> ({failed} failed)</span>}
              </p>
            );
          })()}
          <div className="flex flex-wrap gap-2">
            {forumStates.map((state) => (
              <span
                key={state.forumId}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                  state.status === 'loading'
                    ? 'bg-indigo-500/10 text-indigo-300'
                    : state.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : state.status === 'error'
                        ? 'bg-rose-500/10 text-rose-300'
                        : 'bg-neutral-700 theme-text-muted'
                }`}
                aria-label={`${state.forumName}: ${state.status === 'loading' ? 'loading' : state.status === 'success' ? 'loaded' : state.status === 'error' ? 'failed to load' : 'pending'}`}
              >
                {state.status === 'loading' && (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                )}
                {state.status === 'success' && <CheckCircle className="w-3 h-3" aria-hidden="true" />}
                {state.status === 'error' && <XCircle className="w-3 h-3" aria-hidden="true" />}
                <span aria-hidden="true">{state.forumName}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && discussions.length === 0 ? (
          <DiscussionSkeletonList count={8} />
        ) : displayedDiscussions.length === 0 ? (
          <div className="flex items-center justify-center h-64" role="status">
            <div className="text-center">
              <p className="theme-text-secondary mb-2">No discussions found</p>
              {forums.length === 0 ? (
                <p className="theme-text-muted text-sm">Add some forums in the Projects tab to get started</p>
              ) : enabledForumIds.length === 0 ? (
                <p className="theme-text-muted text-sm">Enable some forums in the Projects tab to see discussions</p>
              ) : searchQuery ? (
                <p className="theme-text-muted text-sm">Try a different search term</p>
              ) : dateRange !== 'all' || selectedForumId ? (
                <p className="theme-text-muted text-sm">Try adjusting your filters</p>
              ) : (
                <button
                  onClick={onRefresh}
                  className="text-indigo-400 hover:text-indigo-300 text-sm px-4 py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Click to refresh
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {displayedDiscussions.map((topic) => (
              <MemoizedDiscussionItem
                key={topic.refId}
                topic={topic}
                alerts={alerts}
                isBookmarked={isBookmarked(topic.refId)}
                isRead={isRead(topic.refId)}
                onToggleBookmark={onToggleBookmark}
                onMarkAsRead={onMarkAsRead}
                forumLogoUrl={forumLogoMap.get(topic.protocol.toLowerCase())}
              />
            ))}
            {hasMore && (
              <div className="p-4 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  className="px-4 py-2 min-h-[44px] bg-neutral-800 hover:bg-neutral-700 theme-text-secondary text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Load more ({filteredAndSortedDiscussions.length - displayCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
