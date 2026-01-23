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
        <mark key={i} className="bg-yellow-500/30 text-yellow-200 px-1 rounded">
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
      className={`relative p-4 border-b border-gray-800 dark:border-gray-800 hover:bg-gray-800/50 dark:hover:bg-gray-800/50 transition-colors ${
        hasMatchingKeyword ? 'bg-yellow-900/10 border-l-2 border-l-yellow-500' : ''
      } ${isRead ? 'opacity-70' : ''}`}
    >
      {/* Unread indicator */}
      {!isRead && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
          <Circle className="w-2 h-2 fill-red-500 text-red-500" aria-label="Unread" />
        </div>
      )}

      {/* Bookmark button - positioned outside the link for accessibility */}
      {onToggleBookmark && (
        <button
          onClick={handleBookmarkClick}
          className={`absolute top-4 right-4 z-10 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
            isBookmarked
              ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
          }`}
          aria-label={`${isBookmarked ? 'Remove from' : 'Add to'} bookmarks: ${topic.title}`}
          aria-pressed={isBookmarked}
        >
          {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
        </button>
      )}

      <a
        href={topicUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        className="flex items-start gap-3 pr-14 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-lg"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center overflow-hidden">
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
            <span className="text-white text-sm font-bold" aria-hidden="true">
              {topic.protocol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <span>{formatTimestamp(topic.bumpedAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{topic.protocol}</span>
            <span aria-hidden="true">·</span>
            <span>Discourse Discussion</span>
            {topic.pinned && <Pin className="w-3 h-3 text-red-400" aria-label="Pinned" />}
            {topic.closed && <Lock className="w-3 h-3 text-orange-400" aria-label="Closed" />}
            {topic.archived && <Archive className="w-3 h-3 text-gray-500" aria-label="Archived" />}
          </div>

          <h3
            className={`font-medium mb-2 line-clamp-2 ${isRead ? 'text-gray-400' : 'text-white dark:text-white'}`}
          >
            {highlightKeywords(topic.title, alerts)}
          </h3>

          <div className="flex items-center gap-4 text-xs text-gray-400">
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
              <div className="flex items-center gap-1 flex-wrap">
                {topic.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
                    {tag}
                  </span>
                ))}
                {topic.tags.length > 3 && <span className="text-gray-600">+{topic.tags.length - 3}</span>}
              </div>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}
