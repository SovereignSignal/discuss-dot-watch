'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { MessageSquare, Eye, ThumbsUp, Pin, Lock, Archive, Bookmark, BookmarkCheck, Clock, Sparkles, ExternalLink, TrendingUp, User, Coins, Zap } from 'lucide-react';
import { DiscussionTopic, KeywordAlert, DateFilterMode } from '@/types';
import type { GrantChip } from '@/hooks/useGrantChips';

function isExternalSource(topic: DiscussionTopic): boolean {
  return !!topic.sourceType && topic.sourceType !== 'discourse';
}

function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  try { const p = new URL(url); return p.protocol === 'https:' || p.protocol === 'http:'; } catch { return false; }
}

type Vertical = 'crypto' | 'ai' | 'oss' | 'neutral';

interface DiscussionItemProps {
  topic: DiscussionTopic;
  alerts: KeywordAlert[];
  isBookmarked?: boolean;
  isRead?: boolean;
  isSelected?: boolean;
  onToggleBookmark?: (topic: DiscussionTopic) => void;
  onMarkAsRead?: (refId: string) => void;
  onSelect?: (topic: DiscussionTopic) => void;
  onTagClick?: (tag: string) => void;
  forumLogoUrl?: string;
  forumDisplayName?: string;
  /** Per-vertical accent for the forum chip — applied via --ds-ticker-* CSS vars. */
  vertical?: Vertical;
  dateFilterMode?: DateFilterMode;
  /** Reason chips: this topic was classified as grants/funding by the scan. */
  grantChip?: GrantChip;
  /** Reason chips: this topic is in the cross-category trending (Briefs) set. */
  isTrending?: boolean;
}

function tickerColors(v: Vertical) {
  if (v === 'crypto') return { fg: 'var(--ds-ticker-crypto-fg)', bg: 'var(--ds-ticker-crypto-bg)', border: 'var(--ds-ticker-crypto-border)' };
  if (v === 'ai')     return { fg: 'var(--ds-ticker-ai-fg)',     bg: 'var(--ds-ticker-ai-bg)',     border: 'var(--ds-ticker-ai-border)' };
  if (v === 'oss')    return { fg: 'var(--ds-ticker-oss-fg)',    bg: 'var(--ds-ticker-oss-bg)',    border: 'var(--ds-ticker-oss-border)' };
  return                     { fg: 'var(--ds-fg-muted)',         bg: 'var(--ds-bg-elev)',          border: 'var(--ds-border)' };
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

function highlightKeywords(text: string, alerts: KeywordAlert[]): React.ReactNode {
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
          style={{ backgroundColor: 'var(--ds-bg-subtle)', color: 'inherit' }}>
          {part}
        </mark>
      );
    }
    return part;
  });
}

export function DiscussionItem({
  topic, alerts, isBookmarked, isRead = false, isSelected = false,
  onToggleBookmark, onMarkAsRead, onSelect, onTagClick, forumLogoUrl, forumDisplayName, vertical = 'neutral', dateFilterMode,
  grantChip, isTrending,
}: DiscussionItemProps) {
  const tc = tickerColors(vertical);
  const isExternal = isExternalSource(topic);
  // External sources use different URL formats
  const topicUrl = topic.externalUrl
    ? topic.externalUrl
    : `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
  const activity = getActivityLevel(topic);

  // Reason chips — say WHY a row deserves attention, not just what it is.
  const titleLower = topic.title.toLowerCase();
  const alertMatch = alerts.find(a => a.isEnabled && a.keyword && titleLower.includes(a.keyword.toLowerCase()))?.keyword ?? null;
  // The deadline is a calendar date (YYYY-MM-DD). Parse as LOCAL midnight
  // (no trailing Z) so it renders as the same calendar day in every timezone.
  // The time-dependent "due soon" flag comes precomputed from useGrantChips —
  // render code can't call Date.now() under the React Compiler.
  const grantDeadline = grantChip?.deadline ? new Date(`${grantChip.deadline.slice(0, 10)}T00:00:00`) : null;
  const validDeadline = grantDeadline !== null && !Number.isNaN(grantDeadline.getTime());
  const deadlineSoon = Boolean(grantChip?.dueSoon) && validDeadline;
  const grantTitle = grantChip
    ? [grantChip.program, grantChip.amount, validDeadline ? `deadline ${format(grantDeadline!, 'MMM d, yyyy')}` : null, `${grantChip.confidence}% confidence`]
        .filter(Boolean).join(' · ')
    : undefined;

  // Base/hover styles as token strings so the JS hover handlers and the
  // static style stay in one vocabulary (design-system CSS variables).
  const restBorder = isSelected ? 'var(--ds-border-strong)' : isRead ? 'var(--ds-border-subtle)' : 'var(--ds-border)';
  const restBg = isSelected ? 'var(--ds-bg-subtle)' : isRead ? 'transparent' : 'var(--ds-bg-card)';

  const handleOpen = () => {
    if (!isRead && onMarkAsRead) onMarkAsRead(topic.refId);
    onSelect?.(topic);
  };

  return (
    <article
      className="group relative overflow-hidden rounded-lg border transition-all duration-150"
      style={{
        borderColor: restBorder,
        backgroundColor: restBg,
        cursor: onSelect ? 'pointer' : 'default',
      }}
      onClick={onSelect ? (e) => {
        // Nested interactive elements (title, tags, bookmark, external link)
        // handle their own clicks.
        if ((e.target as HTMLElement).closest('button, a')) return;
        // The click dispatched at the end of a drag-to-select shouldn't open
        // the reader (or mark the topic read). Normal clicks are unaffected:
        // mousedown collapses any prior selection before click fires.
        if (window.getSelection()?.toString()) return;
        handleOpen();
      } : undefined}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ds-border-strong)'; e.currentTarget.style.backgroundColor = isSelected ? 'var(--ds-bg-subtle)' : 'var(--ds-bg-elev)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = restBorder; e.currentTarget.style.backgroundColor = restBg; }}
    >
      {/* Unread indicator */}
      {!isRead && <div className="absolute left-0 top-0 h-full w-0.5" style={{ backgroundColor: 'var(--ds-fg)' }} />}

      <div style={{ padding: 'var(--ds-density-item-py) var(--ds-density-item-px)' }}>
        <div className="flex items-start gap-3">
          {/* Forum logo */}
          <div className="mt-0.5 hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-md sm:flex overflow-hidden"
            style={{ backgroundColor: 'var(--ds-bg-elev)' }}>
            {isValidImageUrl(forumLogoUrl) ? (
              <img src={forumLogoUrl} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const fallback = img.parentElement?.querySelector('[data-fallback]') as HTMLElement;
                  if (fallback) fallback.style.display = '';
                }} />
            ) : null}
            <span data-fallback className="text-xs font-bold" style={{ color: 'var(--ds-fg)', display: isValidImageUrl(forumLogoUrl) ? 'none' : '' }}>
              {topic.protocol.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="px-1.5 py-0.5 text-[11px] font-medium rounded flex-shrink-0"
                style={{
                  borderColor: tc.border,
                  backgroundColor: tc.bg,
                  color: tc.fg,
                  border: `1px solid ${tc.border}`,
                  fontFamily: 'var(--ds-font-mono)',
                  letterSpacing: '0.02em',
                }}
              >
                {forumDisplayName || topic.protocol}
              </span>
              {grantChip && (
                <span
                  className="flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-semibold rounded flex-shrink-0"
                  style={{
                    color: 'var(--ds-success)',
                    backgroundColor: 'color-mix(in srgb, var(--ds-success) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--ds-success) 35%, transparent)',
                  }}
                  title={grantTitle}
                >
                  <Coins className="w-3 h-3" />
                  {deadlineSoon && grantDeadline ? `grant · due ${format(grantDeadline, 'MMM d')}` : 'grant'}
                </span>
              )}
              {alertMatch && (
                <span
                  className="flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-medium rounded flex-shrink-0"
                  style={{
                    color: 'var(--ds-warn)',
                    backgroundColor: 'color-mix(in srgb, var(--ds-warn) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--ds-warn) 30%, transparent)',
                  }}
                  title={`Matches your keyword alert “${alertMatch}”`}
                >
                  <Zap className="w-3 h-3" />
                  {alertMatch.length > 18 ? `${alertMatch.slice(0, 18)}…` : alertMatch}
                </span>
              )}
              {isTrending && (
                <span
                  className="flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-medium rounded flex-shrink-0"
                  style={{
                    color: 'var(--ds-info)',
                    backgroundColor: 'color-mix(in srgb, var(--ds-info) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--ds-info) 30%, transparent)',
                  }}
                  title="In the top trending set across your categories right now"
                >
                  <TrendingUp className="w-3 h-3" />
                  trending
                </span>
              )}
              {topic.tags.slice(0, 2).map((tag) => {
                const tagName = typeof tag === 'string' ? tag : (tag as { name: string }).name;
                if (!tagName) return null;
                if (onTagClick) {
                  return (
                    <button
                      key={tagName}
                      onClick={(e) => { e.stopPropagation(); onTagClick(tagName); }}
                      className="px-1.5 py-0.5 text-[11px] font-medium rounded flex-shrink-0 hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: 'var(--ds-bg-elev)', color: 'var(--ds-fg-dim)', border: 'none', cursor: 'pointer' }}
                      title={`Filter by tag: ${tagName}`}
                    >
                      {tagName}
                    </button>
                  );
                }
                return (
                  <span key={tagName} className="px-1.5 py-0.5 text-[11px] font-medium rounded flex-shrink-0"
                    style={{ backgroundColor: 'var(--ds-bg-elev)', color: 'var(--ds-fg-dim)' }}>
                    {tagName}
                  </span>
                );
              })}
              {isNewTopic(topic.createdAt) && (
                <span className="flex items-center gap-0.5 text-[11px] font-medium flex-shrink-0" style={{ color: 'var(--ds-fg-dim)' }}>
                  <Sparkles className="w-3 h-3" /> new
                </span>
              )}
              {activity === 'hot' && (
                <span className="text-[11px] font-medium flex-shrink-0" style={{ color: 'var(--ds-fg-dim)' }}>hot</span>
              )}
              {isExternal && (
                <span
                  className="flex items-center gap-1 text-[11px] font-medium flex-shrink-0"
                  style={{ color: 'var(--ds-fg-dim)' }}
                  title="Opens on the source site in a new tab"
                >
                  <ExternalLink className="w-3 h-3" />
                  {topic.sourceType}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-start gap-1.5">
              <h3
                className="font-medium leading-snug line-clamp-2 flex-1"
                style={{
                  color: isRead ? 'var(--ds-fg-dim)' : 'var(--ds-fg)',
                  fontSize: 'var(--ds-density-item-title, 0.9375rem)',
                }}
              >
                {onSelect ? (
                  <button
                    onClick={handleOpen}
                    className="text-left hover:underline"
                  >
                    {highlightKeywords(topic.title, alerts)}
                  </button>
                ) : (
                  <a href={topicUrl} target="_blank" rel="noopener noreferrer"
                    onClick={() => { if (!isRead && onMarkAsRead) onMarkAsRead(topic.refId); }}
                    className="hover:underline">
                    {highlightKeywords(topic.title, alerts)}
                  </a>
                )}
              </h3>
              {onSelect && !isExternal && (
                <a href={topicUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-0.5 p-0.5 rounded hover-action flex-shrink-0"
                  style={{ color: 'var(--ds-fg-dim)' }}
                  title="Open in new tab"
                  onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {topic.excerpt && (
              <p className="density-excerpt mt-0.5 text-[12px] leading-relaxed line-clamp-2"
                style={{ color: 'var(--ds-fg-dim)' }}>
                {topic.excerpt}
              </p>
            )}

            {/* Meta inline */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--ds-fg-dim)' }}>
              {isExternalSource(topic) ? (
                <>
                  {topic.authorName && (
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{topic.authorName}</span>
                  )}
                  {topic.score !== undefined && (
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{topic.score}</span>
                  )}
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{topic.replyCount}</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{topic.replyCount}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{topic.views.toLocaleString()}</span>
                  {topic.likeCount > 0 && <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{topic.likeCount}</span>}
                </>
              )}
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTimestamp(dateFilterMode === 'created' ? topic.createdAt : topic.bumpedAt)}</span>
              {topic.pinned && <Pin className="h-3 w-3" />}
              {topic.closed && <Lock className="h-3 w-3" />}
              {topic.archived && <Archive className="h-3 w-3" />}
            </div>
          </div>

          {/* Bookmark */}
          {onToggleBookmark && (
            <button onClick={() => onToggleBookmark(topic)}
              className={`p-1.5 rounded-md flex-shrink-0 ${isBookmarked ? '' : 'hover-action'}`}
              style={{ color: 'var(--ds-fg-dim)' }}
              title={isBookmarked ? 'Remove bookmark' : 'Save discussion'}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Save discussion'}>
              {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
