'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Archive, Bookmark, BookmarkCheck, Clock, Sparkles } from 'lucide-react';
import { DiscussionTopic, KeywordAlert } from '@/types';

function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
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
  if (isToday(date)) return format(date, 'h:mm a');
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
        <mark key={i} className="px-1 py-0.5 rounded font-semibold"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', color: 'inherit' }}>
          {part}
        </mark>
      );
    }
    return part;
  });
}

export function DiscussionItem({
  topic, alerts, isBookmarked, isRead = false,
  onToggleBookmark, onMarkAsRead, forumLogoUrl, isDark = true,
}: DiscussionItemProps) {
  const topicUrl = `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
  const activity = getActivityLevel(topic);

  // Pure black/white/gray palette
  const fg = isDark ? '#fafafa' : '#09090b';
  const fgMuted = isDark ? '#a1a1aa' : '#71717a';
  const fgDim = isDark ? '#52525b' : '#a1a1aa';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const badgeBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  return (
    <article
      className="group relative overflow-hidden rounded-xl border transition-all duration-200"
      style={{
        borderColor: isRead ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : border,
        backgroundColor: isRead ? 'transparent' : cardBg,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isRead ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : border; }}
    >
      {/* Unread bar */}
      {!isRead && (
        <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: fg }} />
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {/* Forum badge */}
          <div
            className="mt-1 hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg sm:flex overflow-hidden"
            style={{ backgroundColor: badgeBg }}
          >
            {isValidImageUrl(forumLogoUrl) ? (
              <img src={forumLogoUrl} alt="" className="w-6 h-6 object-contain" referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; if ((e.target as HTMLImageElement).nextElementSibling) ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.display = ''; }}
              />
            ) : null}
            <span className="text-sm font-bold" style={{ color: fg, display: isValidImageUrl(forumLogoUrl) ? 'none' : '' }}>
              {topic.protocol.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header badges */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded-md border capitalize"
                style={{ borderColor: border, backgroundColor: badgeBg, color: fg }}>
                {topic.protocol}
              </span>
              {topic.tags.slice(0, 3).map((tag) => {
                const tagName = typeof tag === 'string' ? tag : (tag as { name: string }).name;
                return (
                  <span key={tagName} className="px-2 py-0.5 text-xs font-medium rounded-md"
                    style={{ backgroundColor: badgeBg, color: fgMuted }}>
                    {tagName}
                  </span>
                );
              })}
              {isNewTopic(topic.createdAt) && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md"
                  style={{ backgroundColor: badgeBg, color: fgMuted }}>
                  <Sparkles className="w-3 h-3" /> new
                </span>
              )}
              {activity === 'hot' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-md"
                  style={{ backgroundColor: badgeBg, color: fgMuted }}>
                  hot
                </span>
              )}
              {activity === 'active' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-md"
                  style={{ backgroundColor: badgeBg, color: fgMuted }}>
                  active
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-base sm:text-lg font-semibold leading-tight transition-colors line-clamp-2"
              style={{ color: isRead ? (isDark ? 'rgba(250,250,250,0.5)' : 'rgba(9,9,11,0.5)') : fg }}>
              <a href={topicUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => { if (!isRead && onMarkAsRead) onMarkAsRead(topic.refId); }}
                className="hover:underline">
                {highlightKeywords(topic.title, alerts, isDark)}
              </a>
            </h3>

            {/* Meta */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" style={{ color: fgDim }}>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {topic.replyCount}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {topic.views.toLocaleString()}
              </span>
              {topic.likeCount > 0 && (
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {topic.likeCount}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTimestamp(topic.bumpedAt)}
              </span>
              {topic.pinned && <span title="Pinned"><Pin className="h-3.5 w-3.5" /></span>}
              {topic.closed && <span title="Closed"><Lock className="h-3.5 w-3.5" /></span>}
              {topic.archived && <span title="Archived"><Archive className="h-3.5 w-3.5" /></span>}
            </div>
          </div>

          {/* Bookmark */}
          {onToggleBookmark && (
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={() => onToggleBookmark(topic)}
                className={`p-2 rounded-lg transition-all ${isBookmarked ? '' : 'opacity-0 group-hover:opacity-60'}`}
                style={{ color: fgDim }}
              >
                {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
