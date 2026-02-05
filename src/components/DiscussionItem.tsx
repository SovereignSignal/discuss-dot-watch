'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Archive, Bookmark, BookmarkCheck, Flame, TrendingUp, Sparkles, Clock } from 'lucide-react';
import { DiscussionTopic, KeywordAlert } from '@/types';

// Validate image URLs to prevent malicious content
function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Only allow https (and http for local dev)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    // Block data: and javascript: URLs (double-check even though URL() should reject these)
    if (url.toLowerCase().startsWith('data:') || url.toLowerCase().startsWith('javascript:')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

interface DiscussionItemProps {
  topic: DiscussionTopic;
  alerts: KeywordAlert[];
  isBookmarked?: boolean;
  isRead?: boolean;
  onToggleBookmark?: (topic: DiscussionTopic) => void;
  onMarkAsRead?: (refId: string) => void;
  forumLogoUrl?: string;
}

function formatTimestamp(dateString: string, short = false): string {
  const date = new Date(dateString);
  if (isToday(date)) {
    return short ? format(date, 'HH:mm') : format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return short ? 'Yesterday' : 'Yesterday ' + format(date, 'HH:mm');
  }
  return short ? format(date, 'MMM dd') : format(date, 'MMM dd, HH:mm');
}

function isNewTopic(createdAt: string): boolean {
  const created = new Date(createdAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return created > sevenDaysAgo;
}

// Limits for keyword matching to prevent ReDoS attacks
const MAX_KEYWORD_LENGTH = 100;
const MAX_KEYWORDS = 50;

// Calculate activity level based on engagement metrics
function getActivityLevel(topic: DiscussionTopic): 'hot' | 'trending' | 'normal' {
  const { replyCount, views, likeCount } = topic;
  
  // Hot: Very high engagement
  if (replyCount >= 20 || views >= 2000 || likeCount >= 30) {
    return 'hot';
  }
  
  // Trending: Good engagement
  if (replyCount >= 8 || views >= 500 || likeCount >= 10) {
    return 'trending';
  }
  
  return 'normal';
}

function highlightKeywords(text: string, alerts: KeywordAlert[]): React.ReactNode {
  if (alerts.length === 0) return text;

  // Filter and limit keywords to prevent ReDoS
  const enabledKeywords = alerts
    .filter((a) => a.isEnabled && a.keyword.length <= MAX_KEYWORD_LENGTH)
    .slice(0, MAX_KEYWORDS)
    .map((a) => a.keyword.toLowerCase());

  if (enabledKeywords.length === 0) return text;

  const regex = new RegExp(
    `(${enabledKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (enabledKeywords.includes(part.toLowerCase())) {
      return (
        <mark key={i} className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-md font-semibold border border-indigo-500/30">
          {part}
        </mark>
      );
    }
    return part;
  });
}

export function DiscussionItem({
  topic,
  alerts,
  isBookmarked,
  isRead = false,
  onToggleBookmark,
  onMarkAsRead,
  forumLogoUrl,
}: DiscussionItemProps) {
  const topicUrl = `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
  const hasMatchingKeyword = alerts.some(
    (a) => a.isEnabled && topic.title.toLowerCase().includes(a.keyword.toLowerCase())
  );

  const handleBookmarkClick = () => {
    onToggleBookmark?.(topic);
  };

  const handleLinkClick = () => {
    if (!isRead && onMarkAsRead) {
      onMarkAsRead(topic.refId);
    }
  };

  return (
    <article
      className="relative group mx-3 my-2 p-4 rounded-2xl border backdrop-blur-sm transition-all duration-200 hover:border-zinc-700/80"
      style={{ 
        backgroundColor: hasMatchingKeyword ? 'rgba(139, 92, 246, 0.08)' : 'rgba(24, 24, 27, 0.6)', 
        borderColor: hasMatchingKeyword ? 'rgba(139, 92, 246, 0.3)' : 'rgba(63, 63, 70, 0.4)' 
      }}
    >
      {/* Unread indicator - subtle left border */}
      {!isRead && (
        <div className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-gradient-to-b from-violet-500 to-violet-600" aria-label="Unread" />
      )}

      {/* Bookmark button - positioned outside the link for accessibility */}
      {onToggleBookmark && (
        <button
          onClick={handleBookmarkClick}
          className={`absolute top-4 right-4 z-10 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
            isBookmarked
              ? 'text-indigo-400 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30'
              : 'theme-text-muted opacity-0 group-hover:opacity-100 hover:theme-text hover:bg-neutral-700/80 border border-transparent hover:border-neutral-600'
          }`}
          aria-label={`${isBookmarked ? 'Remove from' : 'Add to'} bookmarks: ${topic.title}`}
          aria-pressed={isBookmarked}
        >
          {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      )}

      <a
        href={topicUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        className="flex items-start gap-4 pr-14 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-lg"
      >
        {/* Protocol Logo */}
        <div 
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shadow-sm"
          style={{ 
            backgroundColor: isValidImageUrl(forumLogoUrl) ? 'var(--card-bg)' : undefined,
            boxShadow: isValidImageUrl(forumLogoUrl) ? '0 0 0 1px var(--card-border)' : '0 0 0 1px rgba(255,255,255,0.1)',
            background: isValidImageUrl(forumLogoUrl) ? undefined : 'linear-gradient(to bottom right, #6366f1, #4f46e5)'
          }}
        >
          {isValidImageUrl(forumLogoUrl) ? (
            <img
              src={forumLogoUrl}
              alt=""
              aria-hidden="true"
              className="w-7 h-7 object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
                const parent = target.parentElement;
                if (parent) {
                  parent.style.background = 'linear-gradient(to bottom right, #6366f1, #4f46e5)';
                  parent.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.1)';
                }
              }}
            />
          ) : null}
          <span 
            className="text-white text-xs font-bold tracking-wide" 
            aria-hidden="true"
            style={{ display: isValidImageUrl(forumLogoUrl) ? 'none' : 'flex' }}
          >
            {topic.protocol.slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-0.5">
          {/* Title - Primary focus */}
          <h3
            className={`text-[15px] font-semibold leading-snug mb-2 line-clamp-2 ${isRead ? 'theme-text-muted' : 'theme-text'}`}
          >
            {highlightKeywords(topic.title, alerts)}
          </h3>

          {/* Meta row - Protocol, dates, activity, status */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs mb-2.5">
            <span className="font-medium text-indigo-500 capitalize">{topic.protocol}</span>
            <span className="theme-text-muted" aria-hidden="true">·</span>
            
            {/* Created date */}
            <span className="flex items-center gap-1 theme-text-muted" title={`Created: ${format(new Date(topic.createdAt), 'PPP')}`}>
              <Sparkles className="w-3 h-3 text-emerald-500" aria-hidden="true" />
              <span>{formatTimestamp(topic.createdAt, true)}</span>
            </span>
            
            {/* Last activity - only show if different from created */}
            {topic.bumpedAt !== topic.createdAt && (
              <>
                <span className="theme-text-muted" aria-hidden="true">·</span>
                <span className="flex items-center gap-1 theme-text-muted" title={`Last activity: ${format(new Date(topic.bumpedAt), 'PPP p')}`}>
                  <Clock className="w-3 h-3 text-amber-500" aria-hidden="true" />
                  <span>{formatTimestamp(topic.bumpedAt, true)}</span>
                </span>
              </>
            )}
            
            {/* NEW badge for recently created topics */}
            {isNewTopic(topic.createdAt) && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold">
                NEW
              </span>
            )}
            
            {/* Activity indicators */}
            {getActivityLevel(topic) === 'hot' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 font-medium" title="High activity">
                <Flame className="w-3 h-3" aria-hidden="true" />
                <span className="text-[10px]">Hot</span>
              </span>
            )}
            {getActivityLevel(topic) === 'trending' && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-500 font-medium" title="Trending">
                <TrendingUp className="w-3 h-3" aria-hidden="true" />
                <span className="text-[10px]">Active</span>
              </span>
            )}
            
            {/* Status icons */}
            {topic.pinned && (
              <span className="flex items-center gap-1 text-indigo-400" title="Pinned">
                <Pin className="w-3 h-3" aria-label="Pinned" />
              </span>
            )}
            {topic.closed && (
              <span className="flex items-center gap-1 text-amber-500" title="Closed">
                <Lock className="w-3 h-3" aria-label="Closed" />
              </span>
            )}
            {topic.archived && (
              <span className="flex items-center gap-1 theme-text-muted" title="Archived">
                <Archive className="w-3 h-3" aria-label="Archived" />
              </span>
            )}
          </div>

          {/* Bottom row - Stats and Tags */}
          <div className="flex items-center justify-between gap-4">
            {/* Stats - compact inline */}
            <div className="flex items-center gap-3 text-xs theme-text-muted">
              <span className="flex items-center gap-1.5" aria-label={`${topic.replyCount} replies`}>
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="tabular-nums">{topic.replyCount}</span>
              </span>
              <span className="flex items-center gap-1.5 hidden sm:flex" aria-label={`${topic.views} views`}>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="tabular-nums">{topic.views.toLocaleString()}</span>
              </span>
              <span className="flex items-center gap-1.5" aria-label={`${topic.likeCount} likes`}>
                <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="tabular-nums">{topic.likeCount}</span>
              </span>
            </div>

            {/* Tags - right aligned */}
            {topic.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {topic.tags.slice(0, 2).map((tag) => {
                  const tagName = typeof tag === 'string' ? tag : (tag as { name: string }).name;
                  return (
                    <span 
                      key={tagName} 
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium theme-text-secondary"
                      style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                    >
                      {tagName}
                    </span>
                  );
                })}
                {topic.tags.length > 2 && (
                  <span className="text-[11px] theme-text-muted font-medium">+{topic.tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}
