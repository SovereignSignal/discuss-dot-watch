'use client';

import { useState, useMemo, memo } from 'react';
import { RefreshCw, Clock, CheckCircle, XCircle, Loader2, Trash2, CheckCheck } from 'lucide-react';
import { DiscussionTopic, KeywordAlert, DateRangeFilter, DateFilterMode, Forum, SortOption } from '@/types';
import { getProtocolLogo } from '@/lib/logoUtils';
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
  isDark?: boolean;
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
  isDark = true,
}: DiscussionFeedProps) {
  const [displayCount, setDisplayCount] = useState(20);
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('activity');
  const [selectedForumId, setSelectedForumId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const forumLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    forums.forEach((forum) => {
      const logoUrl = forum.logoUrl || getProtocolLogo(forum.name);
      if (logoUrl) {
        map.set(forum.cname.toLowerCase(), logoUrl);
      }
    });
    return map;
  }, [forums]);

  const filteredAndSortedDiscussions = useMemo(() => {
    const filtered = discussions.filter((topic) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          topic.title.toLowerCase().includes(query) ||
          topic.protocol.toLowerCase().includes(query) ||
          topic.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      if (dateRange !== 'all') {
        const dateField = dateFilterMode === 'created' ? topic.createdAt : topic.bumpedAt;
        const topicDate = new Date(dateField);
        if (dateRange === 'today' && !isToday(topicDate)) return false;
        if (dateRange === 'week' && !isThisWeek(topicDate)) return false;
        if (dateRange === 'month' && !isThisMonth(topicDate)) return false;
      }

      if (selectedForumId) {
        const forum = forums.find((f) => f.id === selectedForumId);
        if (forum && topic.protocol.toLowerCase() !== forum.cname.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

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
  }, [discussions, searchQuery, dateRange, dateFilterMode, selectedForumId, forums, sortBy]);

  const displayedDiscussions = filteredAndSortedDiscussions.slice(0, displayCount);
  const hasMore = displayCount < filteredAndSortedDiscussions.length;

  const handleLoadMore = () => setDisplayCount((prev) => prev + 20);
  const handleMarkAllAsRead = () => {
    const visibleRefIds = displayedDiscussions.map((d) => d.refId);
    onMarkAllAsRead(visibleRefIds);
  };

  return (
    <section className="flex-1 flex flex-col" aria-label="Discussion feed">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-4">
          <h2 
            className="text-lg font-semibold"
            style={{ color: isDark ? '#fafafa' : '#18181b' }}
          >
            Discussions
          </h2>
          {unreadCount > 0 && (
            <span 
              className="px-2.5 py-1 text-xs font-medium rounded-full"
              style={{ backgroundColor: '#8b5cf6', color: 'white' }}
            >
              {unreadCount} new
            </span>
          )}
          {lastUpdated && (
            <span 
              className="flex items-center gap-1 text-xs hidden sm:flex"
              style={{ color: isDark ? '#71717a' : '#a1a1aa' }}
            >
              <Clock className="w-3 h-3" />
              Updated {format(lastUpdated, 'HH:mm:ss')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl transition-all"
              style={{ 
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                color: isDark ? '#a1a1aa' : '#71717a'
              }}
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Mark read</span>
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
            style={{ 
              backgroundColor: '#8b5cf6',
              color: 'white'
            }}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      <FeedFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        dateFilterMode={dateFilterMode}
        onDateFilterModeChange={setDateFilterMode}
        selectedForumId={selectedForumId}
        onForumFilterChange={setSelectedForumId}
        forums={forums.filter((f) => f.isEnabled)}
        sortBy={sortBy}
        onSortChange={setSortBy}
        isDark={isDark}
      />

      {/* Defunct forums warning */}
      {onRemoveForum && forumStates.some((s) => s.isDefunct) && (
        <div 
          className="px-6 py-3 border-b"
          style={{ 
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)',
            borderColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)'
          }}
        >
          <p className="text-amber-500 text-sm mb-2">Some forums have shut down or moved:</p>
          <div className="flex flex-wrap gap-2">
            {forumStates
              .filter((s) => s.isDefunct)
              .map((state) => (
                <span
                  key={state.forumId}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
                >
                  {state.forumName}
                  <button
                    onClick={() => onRemoveForum(state.forumId)}
                    className="p-1 hover:bg-amber-500/20 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && forumStates.length > 0 && (
        <div
          className="px-6 py-3 border-b"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
        >
          {(() => {
            const completed = forumStates.filter(s => s.status === 'success' || s.status === 'error').length;
            const total = forumStates.length;
            const failed = forumStates.filter(s => s.status === 'error').length;
            return (
              <p className="text-xs mb-2" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
                Loading forums: {completed} of {total} complete
                {failed > 0 && <span className="text-rose-400"> ({failed} failed)</span>}
              </p>
            );
          })()}
          <div className="flex flex-wrap gap-2">
            {forumStates.map((state) => (
              <span
                key={state.forumId}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{
                  backgroundColor: state.status === 'loading'
                    ? 'rgba(139, 92, 246, 0.1)'
                    : state.status === 'success'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : state.status === 'error'
                        ? 'rgba(244, 63, 94, 0.1)'
                        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                  color: state.status === 'loading'
                    ? '#8b5cf6'
                    : state.status === 'success'
                      ? '#10b981'
                      : state.status === 'error'
                        ? '#f43f5e'
                        : (isDark ? '#71717a' : '#a1a1aa')
                }}
              >
                {state.status === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
                {state.status === 'success' && <CheckCircle className="w-3 h-3" />}
                {state.status === 'error' && <XCircle className="w-3 h-3" />}
                {state.forumName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Discussion list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && discussions.length === 0 ? (
          <DiscussionSkeletonList count={8} />
        ) : displayedDiscussions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p style={{ color: isDark ? '#a1a1aa' : '#71717a' }} className="mb-2">No discussions found</p>
              {forums.length === 0 ? (
                <p className="text-sm" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                  Add some forums in the Communities tab to get started
                </p>
              ) : enabledForumIds.length === 0 ? (
                <p className="text-sm" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                  Enable some forums in the Communities tab to see discussions
                </p>
              ) : searchQuery ? (
                <p className="text-sm" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                  Try a different search term
                </p>
              ) : dateRange !== 'all' || selectedForumId ? (
                <p className="text-sm" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                  Try adjusting your filters
                </p>
              ) : (
                <button
                  onClick={onRefresh}
                  className="text-violet-500 hover:text-violet-400 text-sm px-4 py-2"
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
                isDark={isDark}
              />
            ))}
            {hasMore && (
              <div className="py-4 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  className="px-4 py-2.5 text-sm rounded-xl transition-all"
                  style={{ 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    color: isDark ? '#a1a1aa' : '#71717a'
                  }}
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
