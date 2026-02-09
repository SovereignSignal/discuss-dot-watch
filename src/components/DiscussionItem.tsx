'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Archive, Bookmark, BookmarkCheck, Clock, Sparkles, ExternalLink } from 'lucide-react';
import { DiscussionTopic, KeywordAlert } from '@/types';
import { c } from '@/lib/theme';

function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  try { const p = new URL(url); return p.protocol === 'https:' || p.protocol === 'http:'; } catch { return false; }
}

interface DiscussionItemProps {
  topic: DiscussionTopic;
  alerts: KeywordAlert[];
  isBookmarked?: boolean;
  isRead?: boolean;
  isSelected?: boolean;
  onToggleBookmark?: (topic: DiscussionTopic) => void;
  onMarkAsRead?: (refId: string) => void;
  onSelect?: (topic: DiscussionTopic) => void;
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
  const regex = new RegExp(`(${enabledKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (enabledKeywords.includes(part.toLowerCase())) {
      return (
        <mark key={i} className="px-0.5 rounded font-semibold"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', color: 'inherit' }}>
          {part}
        </mark>
      );
    }
    return part;
  });
}

export function DiscussionItem({
  topic, alerts, isBookmarked, isRead = false, isSelected = false,
  onToggleBookmark, onMarkAsRead, onSelect, forumLogoUrl, isDark = true,
}: DiscussionItemProps) {
  const topicUrl = `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
  const activity = getActivityLevel(topic);
  const t = c(isDark);

  return (
    <article
      className="group relative overflow-hidden rounded-lg border transition-all duration-150"
      style={{
        borderColor: isSelected ? t.borderActive : isRead ? t.readBorder : t.border,
        backgroundColor: isSelected ? t.bgActive : isRead ? 'transparent' : t.bgCard,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.hoverBorder; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isRead ? t.readBorder : t.border; }}
    >
      {/* Unread indicator */}
      {!isRead && <div className="absolute left-0 top-0 h-full w-0.5" style={{ backgroundColor: t.fg }} />}

      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-start gap-3">
          {/* Forum logo */}
          <div className="mt-0.5 hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-md sm:flex overflow-hidden"
            style={{ backgroundColor: t.bgBadge }}>
            {isValidImageUrl(forumLogoUrl) ? (
              <img src={forumLogoUrl} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const fallback = img.parentElement?.querySelector('[data-fallback]') as HTMLElement;
                  if (fallback) fallback.style.display = '';
                }} />
            ) : null}
            <span data-fallback className="text-xs font-bold" style={{ color: t.fg, display: isValidImageUrl(forumLogoUrl) ? 'none' : '' }}>
              {topic.protocol.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-1.5 py-0.5 text-[11px] font-medium rounded border capitalize flex-shrink-0"
                style={{ borderColor: t.border, backgroundColor: t.bgBadge, color: t.fgSecondary }}>
                {topic.protocol}
              </span>
              {topic.tags.slice(0, 2).map((tag) => {
                const tagName = typeof tag === 'string' ? tag : (tag as { name: string }).name;
                return (
                  <span key={tagName} className="px-1.5 py-0.5 text-[11px] font-medium rounded flex-shrink-0"
                    style={{ backgroundColor: t.bgBadge, color: t.fgDim }}>
                    {tagName}
                  </span>
                );
              })}
              {isNewTopic(topic.createdAt) && (
                <span className="flex items-center gap-0.5 text-[11px] font-medium flex-shrink-0" style={{ color: t.fgDim }}>
                  <Sparkles className="w-3 h-3" /> new
                </span>
              )}
              {activity === 'hot' && (
                <span className="text-[11px] font-medium flex-shrink-0" style={{ color: t.fgDim }}>hot</span>
              )}
            </div>

            <div className="mt-1 flex items-start gap-1.5">
              <h3 className="text-sm sm:text-[15px] font-medium leading-snug line-clamp-2 flex-1"
                style={{ color: isRead ? t.readFg : t.fg }}>
                {onSelect ? (
                  <button
                    onClick={() => {
                      if (!isRead && onMarkAsRead) onMarkAsRead(topic.refId);
                      onSelect(topic);
                    }}
                    className="text-left hover:underline"
                  >
                    {highlightKeywords(topic.title, alerts, isDark)}
                  </button>
                ) : (
                  <a href={topicUrl} target="_blank" rel="noopener noreferrer"
                    onClick={() => { if (!isRead && onMarkAsRead) onMarkAsRead(topic.refId); }}
                    className="hover:underline">
                    {highlightKeywords(topic.title, alerts, isDark)}
                  </a>
                )}
              </h3>
              {onSelect && (
                <a href={topicUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-0.5 p-0.5 rounded opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
                  style={{ color: t.fgDim }}
                  title="Open in new tab"
                  onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {topic.excerpt && (
              <p className="mt-0.5 text-[12px] leading-relaxed line-clamp-2"
                style={{ color: t.fgDim }}>
                {topic.excerpt}
              </p>
            )}

            {/* Meta inline */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: t.fgDim }}>
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{topic.replyCount}</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{topic.views.toLocaleString()}</span>
              {topic.likeCount > 0 && <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{topic.likeCount}</span>}
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTimestamp(topic.bumpedAt)}</span>
              {topic.pinned && <Pin className="h-3 w-3" />}
              {topic.closed && <Lock className="h-3 w-3" />}
              {topic.archived && <Archive className="h-3 w-3" />}
            </div>
          </div>

          {/* Bookmark */}
          {onToggleBookmark && (
            <button onClick={() => onToggleBookmark(topic)}
              className={`p-1.5 rounded-md transition-all flex-shrink-0 ${isBookmarked ? '' : 'opacity-0 group-hover:opacity-60'}`}
              style={{ color: t.fgDim }}>
              {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
