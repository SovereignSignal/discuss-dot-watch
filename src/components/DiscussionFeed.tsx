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

  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textPrimary = isDark ? '#e4e4e7' : '#18181b';
  const textSecondary = isDark ? '#a1a1aa' : '#71717a';
  const textMuted = isDark ? '#52525b' : '#a1a1aa';

  const forumLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    forums.forEach((forum) => {
      const logoUrl = forum.logoUrl || getProtocolLogo(forum.name);
      if (logoUrl) map.set(forum.cname.toLowerCase(), logoUrl);
    });
    return map;
  }, [forums]);

  const filteredAndSortedDiscussions = useMemo(() => {
    const filtered = discussions.filter((topic) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!topic.title.toLowerCase().includes(query) &&
            !topic.protocol.toLowerCase().includes(query) &&
            !topic.tags.some((tag) => tag.toLowerCase().includes(query))) return false;
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
        if (forum && topic.protocol.toLowerCase() !== forum.cname.toLowerCase()) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'replies': return b.replyCount - a.replyCount;
        case 'views': return b.views - a.views;
        case 'likes': return b.likeCount - a.likeCount;
        default: return new Date(b.bumpedAt).getTime() - new Date(a.bumpedAt).getTime();
      }
    });
  }, [discussions, searchQuery, dateRange, dateFilterMode, selectedForumId, forums, sortBy]);

  const displayedDiscussions = filteredAndSortedDiscussions.slice(0, displayCount);
  const hasMore = displayCount < filteredAndSortedDiscussions.length;

  return (
    <section className="flex-1 flex flex-col" aria-label="Discussion feed">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 h-14 border-b flex-shrink-0"
        style={{ borderColor }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold" style={{ color: textPrimary }}>
            Discussions
          </h2>
          {unreadCount > 0 && (
            <span className="text-[12px] font-medium" style={{ color: textMuted }}>
              {unreadCount} unread
            </span>
          )}
          {lastUpdated && (
            <span className="hidden sm:flex items-center gap-1 text-[11px]" style={{ color: textMuted }}>
              <Clock className="w-3 h-3" />
              {format(lastUpdated, 'HH:mm')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={() => onMarkAllAsRead(displayedDiscussions.map(d => d.refId))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors"
              style={{ color: textSecondary }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mark read</span>
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: textSecondary
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading' : 'Refresh'}
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

      {/* Defunct forums */}
      {onRemoveForum && forumStates.some((s) => s.isDefunct) && (
        <div className="px-5 py-2 border-b text-[12px]" style={{ borderColor, color: textMuted }}>
          <span>Defunct forums: </span>
          {forumStates.filter((s) => s.isDefunct).map((state) => (
            <span key={state.forumId} className="inline-flex items-center gap-1 mr-2">
              {state.forumName}
              <button onClick={() => onRemoveForum(state.forumId)} className="hover:opacity-70">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Loading progress */}
      {isLoading && forumStates.length > 0 && (
        <div className="px-5 py-2 border-b text-[11px]" style={{ borderColor, color: textMuted }}>
          Loading: {forumStates.filter(s => s.status === 'success' || s.status === 'error').length}/{forumStates.length}
          {forumStates.filter(s => s.status === 'error').length > 0 && (
            <span style={{ color: '#ef4444' }}>
              {' '}({forumStates.filter(s => s.status === 'error').length} failed)
            </span>
          )}
        </div>
      )}

      {/* Discussion list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && discussions.length === 0 ? (
          <DiscussionSkeletonList count={8} />
        ) : displayedDiscussions.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-[13px] mb-1" style={{ color: textSecondary }}>No discussions found</p>
              <p className="text-[12px]" style={{ color: textMuted }}>
                {forums.length === 0 ? 'Add forums in Communities to get started' :
                 enabledForumIds.length === 0 ? 'Enable forums to see discussions' :
                 searchQuery ? 'Try a different search' :
                 'Try adjusting filters'}
              </p>
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
                  onClick={() => setDisplayCount(prev => prev + 20)}
                  className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                  style={{ color: textSecondary }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
