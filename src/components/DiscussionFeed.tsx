'use client';

import { useState, useMemo, memo, useEffect } from 'react';
import { RefreshCw, CheckCheck, MessageSquare } from 'lucide-react';
import { DiscussionTopic, KeywordAlert, DateRangeFilter, DateFilterMode, Forum, SortOption } from '@/types';
import { getProtocolLogo } from '@/lib/logoUtils';
import { DiscussionItem } from './DiscussionItem';
import { DiscussionSkeletonList } from './DiscussionSkeleton';
import { FeedFilters } from './FeedFilters';
import { ForumLoadingState } from '@/hooks/useDiscussions';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { c } from '@/lib/theme';

const MemoizedDiscussionItem = memo(DiscussionItem);

function resolveCategory(cat?: string): string | null {
  if (!cat) return null;
  if (cat.startsWith('crypto')) return 'crypto';
  if (cat.startsWith('ai')) return 'ai';
  if (cat.startsWith('oss')) return 'oss';
  return null;
}

interface DiscussionFeedProps {
  discussions: DiscussionTopic[];
  isLoading: boolean;
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
  activeKeywordFilter?: string | null;
  onSelectTopic?: (topic: DiscussionTopic) => void;
  selectedTopicRefId?: string | null;
  isDark?: boolean;
  totalForumCount?: number;
}

export function DiscussionFeed({
  discussions, isLoading, lastUpdated, onRefresh,
  alerts, searchQuery, enabledForumIds, forumStates, forums,
  isBookmarked, isRead, onToggleBookmark, onMarkAsRead, onMarkAllAsRead,
  unreadCount, onRemoveForum, activeKeywordFilter,
  onSelectTopic, selectedTopicRefId, isDark = true, totalForumCount,
}: DiscussionFeedProps) {
  const [displayCount, setDisplayCount] = useState(20);
  const [dateRange, setDateRange] = useState<DateRangeFilter>('today');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('activity');
  const [selectedForumId, setSelectedForumId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const t = c(isDark);

  // Listen for command menu events
  useEffect(() => {
    const handleSelectForum = (e: Event) => setSelectedForumId((e as CustomEvent).detail);
    const handleSelectCategory = (e: Event) => setSelectedCategory((e as CustomEvent).detail);
    const handleSelectSort = (e: Event) => setSortBy((e as CustomEvent).detail as SortOption);
    window.addEventListener('selectForum', handleSelectForum);
    window.addEventListener('selectCategory', handleSelectCategory);
    window.addEventListener('selectSort', handleSelectSort);
    return () => {
      window.removeEventListener('selectForum', handleSelectForum);
      window.removeEventListener('selectCategory', handleSelectCategory);
      window.removeEventListener('selectSort', handleSelectSort);
    };
  }, []);

  // Map cname → category for filtering
  const forumCategoryMap = useMemo(() => {
    const map = new Map<string, string | null>();
    forums.forEach(f => map.set(f.cname.toLowerCase(), resolveCategory(f.category)));
    return map;
  }, [forums]);

  const forumLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    forums.forEach((forum) => {
      const logoUrl = forum.logoUrl || getProtocolLogo(forum.name);
      if (logoUrl) map.set(forum.cname.toLowerCase(), logoUrl);
    });
    return map;
  }, [forums]);

  // Map cname → display name for rendering
  const forumNameMap = useMemo(() => {
    const map = new Map<string, string>();
    forums.forEach(f => map.set(f.cname.toLowerCase(), f.name));
    return map;
  }, [forums]);

  const filteredAndSortedDiscussions = useMemo(() => {
    const filtered = discussions.filter((topic) => {
      // Keyword filter
      if (activeKeywordFilter) {
        const title = topic.title.toLowerCase();
        if (activeKeywordFilter === 'all') {
          const enabledKeywords = alerts.filter(a => a.isEnabled).map(a => a.keyword.toLowerCase());
          if (enabledKeywords.length > 0 && !enabledKeywords.some(kw => title.includes(kw))) return false;
        } else {
          if (!title.includes(activeKeywordFilter.toLowerCase())) return false;
        }
      }
      // Category filter
      if (selectedCategory) {
        const topicCat = forumCategoryMap.get(topic.protocol.toLowerCase());
        if (topicCat !== selectedCategory) return false;
      }
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!topic.title.toLowerCase().includes(query) &&
            !topic.protocol.toLowerCase().includes(query) &&
            !topic.tags.some((tag) => tag.toLowerCase().includes(query))) return false;
      }
      // Date range
      if (dateRange !== 'all') {
        const dateField = dateFilterMode === 'created' ? topic.createdAt : topic.bumpedAt;
        const topicDate = new Date(dateField);
        if (dateRange === 'today' && !isToday(topicDate)) return false;
        if (dateRange === 'week' && !isThisWeek(topicDate)) return false;
        if (dateRange === 'month' && !isThisMonth(topicDate)) return false;
      }
      // Forum filter
      if (selectedForumId) {
        const forum = forums.find((f) => f.id === selectedForumId);
        if (forum) {
          const proto = topic.protocol.toLowerCase();
          if (proto !== forum.cname.toLowerCase() && proto !== forum.name.toLowerCase()) return false;
        }
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
  }, [discussions, searchQuery, dateRange, dateFilterMode, selectedForumId, selectedCategory, forums, forumCategoryMap, sortBy, activeKeywordFilter, alerts]);

  const displayedDiscussions = filteredAndSortedDiscussions.slice(0, displayCount);
  const hasMore = displayCount < filteredAndSortedDiscussions.length;

  // Compute filtered unread count when category/forum filters are active
  const filteredUnreadCount = useMemo(() => {
    if (!selectedCategory && !selectedForumId) return unreadCount;
    return filteredAndSortedDiscussions.filter(d => !isRead(d.refId)).length;
  }, [selectedCategory, selectedForumId, filteredAndSortedDiscussions, isRead, unreadCount]);

  return (
    <section className="flex-1 flex flex-col" aria-label="Discussion feed">
      {/* Header */}
      <header className="px-5 sm:px-6 pt-5 pb-3 flex-shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: t.fg }}>
              {selectedCategory
                ? `${selectedCategory === 'ai' ? 'AI' : selectedCategory === 'oss' ? 'OSS' : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Discussions`
                : 'All Discussions'}
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: t.fgMuted }}>
              {filteredUnreadCount > 0 ? `${filteredUnreadCount} unread across ` : ''}
              {selectedCategory
                ? new Set(filteredAndSortedDiscussions.map(d => d.protocol)).size
                : (totalForumCount || forums.filter(f => f.isEnabled).length)} forums
              {lastUpdated && ` · Updated ${format(lastUpdated, 'h:mm a')}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => onMarkAllAsRead(displayedDiscussions.map(d => d.refId))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: t.fgSecondary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.bgSubtle; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <CheckCheck className="w-4 h-4" /> Mark read
              </button>
            )}
            <button onClick={onRefresh} disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: t.bgCardHover, color: t.fgSecondary }}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <FeedFilters
        dateRange={dateRange} onDateRangeChange={setDateRange}
        dateFilterMode={dateFilterMode} onDateFilterModeChange={setDateFilterMode}
        selectedForumId={selectedForumId} onForumFilterChange={setSelectedForumId}
        selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory}
        forums={forums.filter((f) => f.isEnabled)}
        sortBy={sortBy} onSortChange={setSortBy} isDark={isDark}
      />

      {/* Loading progress */}
      {isLoading && forumStates.length > 0 && (
        <div className="px-5 py-1.5 border-b text-xs" style={{ borderColor: t.border, color: t.fgMuted }}>
          Loading: {forumStates.filter(s => s.status === 'success' || s.status === 'error').length}/{forumStates.length}
          {forumStates.filter(s => s.status === 'error').length > 0 && (
            <span style={{ color: '#ef4444' }}> ({forumStates.filter(s => s.status === 'error').length} failed)</span>
          )}
        </div>
      )}

      {/* Discussion list */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-3">
        {isLoading && discussions.length === 0 ? (
          <DiscussionSkeletonList count={8} isDark={isDark} />
        ) : displayedDiscussions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center"
            style={{ borderColor: t.border }}>
            <MessageSquare className="h-8 w-8 mb-4" style={{ color: t.fgMuted }} />
            <h3 className="font-semibold" style={{ color: t.fg }}>No discussions found</h3>
            <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
              {forums.length === 0 ? 'Add forums in Communities to get started' :
               enabledForumIds.length === 0 ? 'Enable forums to see discussions' :
               searchQuery ? 'Try a different search term' :
               'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedDiscussions.map((topic) => (
              <MemoizedDiscussionItem key={topic.refId}
                topic={topic} alerts={alerts}
                isBookmarked={isBookmarked(topic.refId)}
                isRead={isRead(topic.refId)}
                isSelected={selectedTopicRefId === topic.refId}
                onToggleBookmark={onToggleBookmark}
                onMarkAsRead={onMarkAsRead}
                onSelect={onSelectTopic}
                forumLogoUrl={forumLogoMap.get(topic.protocol.toLowerCase())}
                forumDisplayName={forumNameMap.get(topic.protocol.toLowerCase())}
                isDark={isDark}
              />
            ))}
            {hasMore && (
              <div className="py-3 flex justify-center">
                <button onClick={() => setDisplayCount(prev => prev + 20)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: t.bgSubtle, color: t.fgSecondary }}>
                  Load more ({filteredAndSortedDiscussions.length - displayCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
