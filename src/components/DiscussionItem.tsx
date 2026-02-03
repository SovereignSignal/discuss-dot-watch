'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Archive, Bookmark, BookmarkCheck, Circle } from 'lucide-react';
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
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Yesterday ' + format(date, 'HH:mm');
  }
  return format(date, 'MMM dd, HH:mm');
}

// Limits for keyword matching to prevent ReDoS attacks
const MAX_KEYWORD_LENGTH = 100;
const MAX_KEYWORDS = 50;

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
      className={`relative group mx-3 my-2 p-4 rounded-lg border transition-all duration-200 ${
        hasMatchingKeyword
          ? 'border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/60'
          : 'theme-card hover:opacity-90'
      } ${isRead ? 'opacity-60' : ''}`}
    >
      {/* Unread indicator */}
      {!isRead && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" aria-label="Unread" />
        </div>
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
        className="flex items-start gap-3 pr-14 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-lg"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
          {isValidImageUrl(topic.imageUrl) ? (
            <img
              src={topic.imageUrl}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-white text-xs font-bold tracking-wide" aria-hidden="true">
              {topic.protocol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs theme-text-muted mb-1.5">
            <span className="theme-text-secondary">{formatTimestamp(topic.bumpedAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize font-medium theme-text-secondary">{topic.protocol}</span>
            {topic.pinned && <Pin className="w-3 h-3 text-indigo-400" aria-label="Pinned" />}
            {topic.closed && <Lock className="w-3 h-3 text-amber-500" aria-label="Closed" />}
            {topic.archived && <Archive className="w-3 h-3 theme-text-muted" aria-label="Archived" />}
          </div>

          <h3
            className={`font-medium mb-2 line-clamp-2 ${isRead ? 'theme-text-muted' : 'theme-text'}`}
          >
            {highlightKeywords(topic.title, alerts)}
          </h3>

          <div className="flex items-center gap-4 text-xs theme-text-secondary">
            <span className="flex items-center gap-1" aria-label={`${topic.replyCount} replies`}>
              <MessageSquare className="w-3 h-3" aria-hidden="true" />
              {topic.replyCount}
            </span>
            <span className="flex items-center gap-1 hidden sm:flex" aria-label={`${topic.views} views`}>
              <Eye className="w-3 h-3" aria-hidden="true" />
              {topic.views}
            </span>
            <span className="flex items-center gap-1" aria-label={`${topic.likeCount} likes`}>
              <ThumbsUp className="w-3 h-3" aria-hidden="true" />
              {topic.likeCount}
            </span>
            {topic.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {topic.tags.slice(0, 3).map((tag) => {
                  // Defensive: handle both string and object tags (API normalizes, but be safe)
                  const tagName = typeof tag === 'string' ? tag : (tag as { name: string }).name;
                  return (
                    <span key={tagName} className="px-2 py-0.5 rounded-full text-[11px] theme-text-secondary" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                      {tagName}
                    </span>
                  );
                })}
                {topic.tags.length > 3 && <span className="theme-text-muted text-[11px]">+{topic.tags.length - 3}</span>}
              </div>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}
