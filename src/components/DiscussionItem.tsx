'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Archive, Bookmark, BookmarkCheck, Clock } from 'lucide-react';
import { DiscussionTopic, KeywordAlert } from '@/types';

function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (url.toLowerCase().startsWith('data:') || url.toLowerCase().startsWith('javascript:')) return false;
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
  isDark?: boolean;
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
}

function isNewTopic(createdAt: string): boolean {
  const created = new Date(createdAt);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return created > threeDaysAgo;
}

const MAX_KEYWORD_LENGTH = 100;
const MAX_KEYWORDS = 50;

function getActivityLevel(topic: DiscussionTopic): 'hot' | 'active' | 'normal' {
  const { replyCount, views, likeCount } = topic;
  if (replyCount >= 20 || views >= 2000 || likeCount >= 30) return 'hot';
  if (replyCount >= 8 || views >= 500 || likeCount >= 10) return 'active';
  return 'normal';
}

function highlightKeywords(text: string, alerts: KeywordAlert[], isDark: boolean): React.ReactNode {
  if (alerts.length === 0) return text;

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
        <mark 
          key={i} 
          className="px-1 py-0.5 rounded font-semibold"
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            color: 'inherit'
          }}
        >
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
  isDark = true,
}: DiscussionItemProps) {
  const topicUrl = `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
  const activity = getActivityLevel(topic);

  const handleBookmarkClick = () => onToggleBookmark?.(topic);
  const handleLinkClick = () => {
    if (!isRead && onMarkAsRead) onMarkAsRead(topic.refId);
  };

  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const hoverBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const textPrimary = isDark ? '#e4e4e7' : '#18181b';
  const textSecondary = isDark ? '#a1a1aa' : '#71717a';
  const textMuted = isDark ? '#52525b' : '#a1a1aa';

  return (
    <article
      className="group relative flex items-center gap-4 px-5 py-4 transition-colors border-b"
      style={{ 
        borderColor,
        opacity: isRead ? 0.6 : 1
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {/* Unread dot */}
      {!isRead && (
        <div 
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: isDark ? '#e4e4e7' : '#18181b' }}
        />
      )}

      {/* Forum icon */}
      <div 
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden text-[11px] font-bold uppercase tracking-wider"
        style={{ 
          backgroundColor: isValidImageUrl(forumLogoUrl) 
            ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') 
            : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
          color: textSecondary
        }}
      >
        {isValidImageUrl(forumLogoUrl) ? (
          <img
            src={forumLogoUrl}
            alt=""
            className="w-5 h-5 object-contain"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.nextElementSibling) (target.nextElementSibling as HTMLElement).style.display = '';
            }}
          />
        ) : null}
        <span style={{ display: isValidImageUrl(forumLogoUrl) ? 'none' : '' }}>
          {topic.protocol.slice(0, 2)}
        </span>
      </div>

      {/* Content */}
      <a
        href={topicUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        className="flex-1 min-w-0"
      >
        {/* Title row */}
        <div className="flex items-start gap-2 mb-1">
          <h3
            className="text-[15px] font-medium leading-snug line-clamp-1 flex-1"
            style={{ color: textPrimary }}
          >
            {highlightKeywords(topic.title, alerts, isDark)}
          </h3>
          
          {/* Subtle status text */}
          <div className="flex items-center gap-2 flex-shrink-0 text-[11px] font-medium pt-0.5" style={{ color: textMuted }}>
            {isNewTopic(topic.createdAt) && (
              <span>new</span>
            )}
            {activity === 'hot' && (
              <span>hot</span>
            )}
            {activity === 'active' && (
              <span>active</span>
            )}
            {topic.pinned && <span title="Pinned"><Pin className="w-3 h-3" /></span>}
            {topic.closed && <span title="Closed"><Lock className="w-3 h-3" /></span>}
          </div>
        </div>

        {/* Meta row */}
        <div 
          className="flex items-center gap-3 text-[12px]"
          style={{ color: textMuted }}
        >
          <span className="font-medium capitalize" style={{ color: textSecondary }}>
            {topic.protocol}
          </span>
          <span>·</span>
          <span>{formatTimestamp(topic.bumpedAt)}</span>
          
          {/* Stats */}
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {topic.replyCount}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {topic.views >= 1000 ? `${(topic.views / 1000).toFixed(1)}k` : topic.views}
          </span>
          {topic.likeCount > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              {topic.likeCount}
            </span>
          )}

          {/* Tags */}
          {topic.tags.length > 0 && (
            <>
              <span>·</span>
              {topic.tags.slice(0, 2).map((tag) => {
                const tagName = typeof tag === 'string' ? tag : (tag as { name: string }).name;
                return (
                  <span key={tagName} style={{ color: textMuted }}>
                    #{tagName}
                  </span>
                );
              })}
            </>
          )}
        </div>
      </a>

      {/* Bookmark - hover reveal */}
      {onToggleBookmark && (
        <button
          onClick={handleBookmarkClick}
          className={`flex-shrink-0 p-1.5 rounded-md transition-all ${
            isBookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
          }`}
          style={{ color: textSecondary }}
        >
          {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      )}
    </article>
  );
}
