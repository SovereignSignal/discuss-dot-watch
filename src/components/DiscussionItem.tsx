'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Archive, Bookmark, BookmarkCheck, Flame, TrendingUp, Sparkles, Clock } from 'lucide-react';
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

function formatTimestamp(dateString: string, short = false): string {
  const date = new Date(dateString);
  if (isToday(date)) return short ? format(date, 'HH:mm') : format(date, 'HH:mm');
  if (isYesterday(date)) return short ? 'Yesterday' : 'Yesterday ' + format(date, 'HH:mm');
  return short ? format(date, 'MMM dd') : format(date, 'MMM dd, HH:mm');
}

function isNewTopic(createdAt: string): boolean {
  const created = new Date(createdAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return created > sevenDaysAgo;
}

const MAX_KEYWORD_LENGTH = 100;
const MAX_KEYWORDS = 50;

function getActivityLevel(topic: DiscussionTopic): 'hot' | 'trending' | 'normal' {
  const { replyCount, views, likeCount } = topic;
  if (replyCount >= 20 || views >= 2000 || likeCount >= 30) return 'hot';
  if (replyCount >= 8 || views >= 500 || likeCount >= 10) return 'trending';
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
          className="px-1.5 py-0.5 rounded font-semibold"
          style={{
            backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)',
            color: isDark ? '#c4b5fd' : '#7c3aed'
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
  const hasMatchingKeyword = alerts.some(
    (a) => a.isEnabled && topic.title.toLowerCase().includes(a.keyword.toLowerCase())
  );

  const handleBookmarkClick = () => onToggleBookmark?.(topic);
  const handleLinkClick = () => {
    if (!isRead && onMarkAsRead) onMarkAsRead(topic.refId);
  };

  return (
    <article
      className="relative group transition-all duration-200"
      style={{ 
        backgroundColor: isDark 
          ? (hasMatchingKeyword ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)')
          : (hasMatchingKeyword ? 'rgba(139, 92, 246, 0.05)' : '#ffffff'),
        borderRadius: '16px',
        border: isDark 
          ? `1px solid ${hasMatchingKeyword ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`
          : `1px solid ${hasMatchingKeyword ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0, 0, 0, 0.06)'}`,
        boxShadow: isDark 
          ? 'none' 
          : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)'
      }}
    >
      {/* Unread indicator */}
      {!isRead && (
        <div 
          className="absolute left-0 top-4 bottom-4 w-1 rounded-full"
          style={{ backgroundColor: '#8b5cf6' }}
        />
      )}

      {/* Bookmark button */}
      {onToggleBookmark && (
        <button
          onClick={handleBookmarkClick}
          className={`absolute top-4 right-4 z-10 p-2.5 rounded-xl transition-all duration-200 ${
            isBookmarked
              ? ''
              : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{
            backgroundColor: isBookmarked 
              ? (isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)')
              : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
            color: isBookmarked ? '#8b5cf6' : (isDark ? '#71717a' : '#a1a1aa')
          }}
          aria-label={`${isBookmarked ? 'Remove from' : 'Add to'} bookmarks`}
        >
          {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      )}

      <a
        href={topicUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        className="flex items-start gap-4 p-5 pr-14 pl-6"
      >
        {/* Protocol Logo */}
        <div 
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
          style={{ 
            backgroundColor: isValidImageUrl(forumLogoUrl) 
              ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') 
              : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          {isValidImageUrl(forumLogoUrl) ? (
            <img
              src={forumLogoUrl}
              alt=""
              className="w-7 h-7 object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)';
                }
              }}
            />
          ) : (
            <span className="text-white text-xs font-bold tracking-wide">
              {topic.protocol.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3
            className="text-[15px] font-semibold leading-snug mb-2.5 line-clamp-2"
            style={{ 
              color: isRead 
                ? (isDark ? '#71717a' : '#a1a1aa') 
                : (isDark ? '#fafafa' : '#18181b')
            }}
          >
            {highlightKeywords(topic.title, alerts, isDark)}
          </h3>

          {/* Meta row */}
          <div 
            className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs mb-3"
            style={{ color: isDark ? '#71717a' : '#a1a1aa' }}
          >
            <span className="font-medium capitalize" style={{ color: '#8b5cf6' }}>
              {topic.protocol}
            </span>
            <span>·</span>
            
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              {formatTimestamp(topic.createdAt, true)}
            </span>
            
            {topic.bumpedAt !== topic.createdAt && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" />
                  {formatTimestamp(topic.bumpedAt, true)}
                </span>
              </>
            )}
            
            {isNewTopic(topic.createdAt) && (
              <span 
                className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ 
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981'
                }}
              >
                NEW
              </span>
            )}
            
            {getActivityLevel(topic) === 'hot' && (
              <span 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium"
                style={{ 
                  backgroundColor: isDark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.1)',
                  color: '#f97316'
                }}
              >
                <Flame className="w-3 h-3" />
                <span className="text-[10px]">Hot</span>
              </span>
            )}
            
            {getActivityLevel(topic) === 'trending' && (
              <span 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium"
                style={{ 
                  backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.1)',
                  color: '#0ea5e9'
                }}
              >
                <TrendingUp className="w-3 h-3" />
                <span className="text-[10px]">Active</span>
              </span>
            )}
            
            {topic.pinned && <span title="Pinned"><Pin className="w-3 h-3 text-violet-400" /></span>}
            {topic.closed && <span title="Closed"><Lock className="w-3 h-3 text-amber-500" /></span>}
            {topic.archived && <span title="Archived"><Archive className="w-3 h-3" /></span>}
          </div>

          {/* Stats and tags */}
          <div className="flex items-center justify-between gap-4">
            <div 
              className="flex items-center gap-4 text-xs"
              style={{ color: isDark ? '#52525b' : '#a1a1aa' }}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="tabular-nums">{topic.replyCount}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span className="tabular-nums">{topic.views.toLocaleString()}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5" />
                <span className="tabular-nums">{topic.likeCount}</span>
              </span>
            </div>

            {topic.tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                {topic.tags.slice(0, 2).map((tag) => {
                  const tagName = typeof tag === 'string' ? tag : (tag as { name: string }).name;
                  return (
                    <span 
                      key={tagName} 
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        color: isDark ? '#a1a1aa' : '#71717a'
                      }}
                    >
                      {tagName}
                    </span>
                  );
                })}
                {topic.tags.length > 2 && (
                  <span className="text-[11px] font-medium" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                    +{topic.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </a>
    </article>
  );
}
