'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { DiscussionTopic } from '@/types';
import { SectionHeader } from './ui/SectionHeader';
import { TickerBadge, Vertical } from './ui/TickerBadge';

interface BriefsTopic extends DiscussionTopic {
  isFollowing?: boolean;
  category?: string;
}

interface BriefsResponse {
  hot: BriefsTopic[];
  fresh: BriefsTopic[];
  category: string;
  cachedForumCount: number;
}

interface BriefsStripProps {
  onSelectTopic?: (topic: DiscussionTopic) => void;
  onSeeAll?: () => void;
  /** Fires once with the refIds of the trending ("hot") set, so the feed can
   *  badge matching rows without a second /api/briefs fetch. */
  onTrendingRefIds?: (refIds: string[]) => void;
}

function verticalFor(cat?: string): Vertical {
  if (cat === 'crypto' || cat === 'ai' || cat === 'oss') return cat;
  return 'neutral';
}

function abbreviateCount(n?: number): string {
  if (n == null) return '';
  if (n >= 1000) {
    const k = n / 1000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

/**
 * Top 3 trending topics across all categories, surfaced as a compact strip
 * at the top of the Feed. Distills Briefs into a sticky module so users
 * don't have to leave the Feed view to discover what's hot.
 */
export function BriefsStrip({ onSelectTopic, onSeeAll, onTrendingRefIds }: BriefsStripProps) {
  const [data, setData] = useState<BriefsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Ref indirection keeps the fetch effect's dep list empty regardless of
  // whether the parent memoizes the callback. Written in an effect, not during
  // render — the React Compiler bails on render-phase ref writes.
  const onTrendingRefIdsRef = useRef(onTrendingRefIds);
  useEffect(() => {
    onTrendingRefIdsRef.current = onTrendingRefIds;
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/briefs?category=all')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: BriefsResponse | null) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
          if (json?.hot?.length) {
            onTrendingRefIdsRef.current?.(json.hot.map((t) => t.refId));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const top = (data?.hot ?? []).slice(0, 3);

  if (loading || top.length === 0) {
    return null; // Don't render anything if there's nothing to show
  }

  const handleClick = (topic: BriefsTopic) => {
    if (onSelectTopic) {
      onSelectTopic(topic);
      return;
    }
    // Fallback: open externally
    const url = topic.externalUrl || `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        padding: '14px 20px',
        background: 'var(--ds-bg-card)',
        borderBottom: `1px solid var(--ds-border)`,
      }}
    >
      <SectionHeader
        meta={
          data?.cachedForumCount
            ? `across ${data.cachedForumCount} forums`
            : undefined
        }
        rightSlot={
          onSeeAll && (
            <button
              onClick={onSeeAll}
              style={{
                fontSize: 'var(--ds-text-sm)',
                color: 'var(--ds-fg-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              View Briefs →
            </button>
          )
        }
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={11} /> Trending right now
        </span>
      </SectionHeader>
      <div
        className="briefs-strip-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
        }}
      >
        {top.map((topic) => {
          const v = verticalFor(topic.category);
          return (
            <button
              key={topic.refId}
              onClick={() => handleClick(topic)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '8px 12px',
                background: 'var(--ds-bg-elev)',
                border: `1px solid var(--ds-border)`,
                borderRadius: 'var(--ds-radius-md)',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--ds-fg)',
                fontFamily: 'var(--ds-font-sans)',
                width: '100%',
                minWidth: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ds-bg-card)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ds-bg-elev)'; }}
            >
              <TickerBadge vertical={v}>{topic.protocol.slice(0, 16)}</TickerBadge>
              <span
                style={{
                  flex: 1,
                  fontSize: 'var(--ds-text-sm)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {topic.title}
              </span>
              <span
                style={{
                  fontFamily: 'var(--ds-font-mono)',
                  fontSize: 'var(--ds-text-xs)',
                  color: 'var(--ds-fg-dim)',
                  flexShrink: 0,
                }}
              >
                {abbreviateCount(topic.replyCount)}r {abbreviateCount(topic.views)}v
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
