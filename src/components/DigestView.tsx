'use client';

import { useState, useEffect, useMemo } from 'react';
import { Newspaper, MessageSquare, Eye, ThumbsUp, TrendingUp, Sparkles, AlertCircle, Target, Vote } from 'lucide-react';
import { DiscussionTopic, KeywordAlert } from '@/types';
import { c } from '@/lib/theme';

type Category = 'all' | 'crypto' | 'ai' | 'oss';

interface BriefsTopic extends DiscussionTopic {
  isFollowing: boolean;
  category: string;
}

interface BriefsResponse {
  hot: BriefsTopic[];
  fresh: BriefsTopic[];
  category: string;
  cachedForumCount: number;
}

interface DigestViewProps {
  onSelectTopic?: (topic: DiscussionTopic) => void;
  isDark?: boolean;
  forumUrls?: string[];
  enabledAlerts?: KeywordAlert[];
}

const GOVERNANCE_TAG_KEYWORDS = ['governance', 'grant', 'grants', 'proposal', 'proposals', 'delegate', 'delegates', 'rfp', 'rfc', 'temp-check', 'temperature-check', 'snapshot-vote'];

// Bracketed prefixes commonly used in governance forum threads.
// Many DAOs gate their proposals via `[ARFC]`, `[DRAFT]`, `[Constitutional]` etc. — match liberally on tag-style brackets.
const GOVERNANCE_TITLE_PREFIXES = /^\[(rfc|arfc|rfp|aip|eip|tip|sip|pip|gp|gip|gov|prop|proposal|temp-?check|temperature|snapshot|draft|constitutional|non-?constitutional|final|onboarding|delisting|listing|elip|lip|cip|stip|mip|wip)[^\]]*\]/i;
// Unbracketed proposal-numbering schemes used widely across DAOs (AIP-3, EIP-721, ELIP-017, etc.)
const GOVERNANCE_TITLE_NUMBERED = /\b(aip|eip|erc|elip|sip|gip|pip|tip|lip|cip|mip|wip|arfc)[- ]?\d+\b/i;
const GOVERNANCE_TITLE_KEYWORDS = /\b(proposal|temperature check|temp check|snapshot vote|delegate program|delegate platform|governance call|treasury request|funding request|onboard|delist|grant request|working group|xgov)\b/i;

function topicTags(topic: DiscussionTopic): string[] {
  const raw = (topic.tags || []) as Array<string | { name?: string; id?: string }>;
  return raw.map((t) => (typeof t === 'string' ? t : t?.name || t?.id || '')).filter(Boolean).map((t) => t.toLowerCase());
}

function topicIsGovernance(topic: DiscussionTopic): boolean {
  const tags = topicTags(topic);
  if (tags.some((tag) => GOVERNANCE_TAG_KEYWORDS.some((kw) => tag.includes(kw)))) return true;
  const title = topic.title || '';
  return GOVERNANCE_TITLE_PREFIXES.test(title) || GOVERNANCE_TITLE_NUMBERED.test(title) || GOVERNANCE_TITLE_KEYWORDS.test(title);
}

function topicMatchesKeyword(topic: DiscussionTopic, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  if (!kw) return false;
  const haystack = `${topic.title} ${topic.excerpt || ''}`.toLowerCase();
  return haystack.includes(kw);
}

function TopicCard({
  topic,
  onSelect,
  isDark,
}: {
  topic: BriefsTopic;
  onSelect?: (topic: BriefsTopic) => void;
  isDark: boolean;
}) {
  const t = c(isDark);

  return (
    <div
      className="rounded-lg border px-4 py-3 transition-colors"
      style={{ borderColor: t.border, backgroundColor: t.bgCard }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="px-1.5 py-0.5 text-[11px] font-medium rounded border capitalize flex-shrink-0"
          style={{ borderColor: t.border, backgroundColor: t.bgBadge, color: t.fgSecondary }}
        >
          {topic.protocol}
        </span>
        {topic.isFollowing && (
          <span
            className="px-1.5 py-0.5 text-[11px] font-medium rounded flex-shrink-0"
            style={{ backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.1)', color: isDark ? '#a5b4fc' : '#4f46e5' }}
          >
            following
          </span>
        )}
      </div>

      <button
        onClick={() => onSelect?.(topic)}
        className="text-sm font-medium text-left hover:underline line-clamp-2"
        style={{ color: t.fg }}
      >
        {topic.title}
      </button>

      {topic.excerpt && (
        <p className="mt-1 text-[12px] leading-relaxed line-clamp-3" style={{ color: t.fgMuted }}>
          {topic.excerpt}
        </p>
      )}

      <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: t.fgDim }}>
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{topic.replyCount}</span>
        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{topic.views.toLocaleString()}</span>
        {topic.likeCount > 0 && <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{topic.likeCount}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count, isDark }: {
  icon: React.ComponentType<{ className?: string; color?: string }>;
  title: string;
  count: number;
  isDark: boolean;
}) {
  const t = c(isDark);
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 mt-6 mb-3">
      <Icon className="w-4 h-4" color={t.fgMuted} />
      <h3 className="text-sm font-semibold" style={{ color: t.fg }}>{title}</h3>
      <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: t.bgBadge, color: t.fgDim }}>
        {count}
      </span>
    </div>
  );
}

function BriefsSkeleton({ isDark }: { isDark: boolean }) {
  const t = c(isDark);
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded" style={{ backgroundColor: t.bgBadge }} />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: t.bgBadge }} />
        ))}
      </div>
    </div>
  );
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'ai', label: 'AI' },
  { id: 'oss', label: 'OSS' },
];

export function DigestView({ onSelectTopic, isDark = true, forumUrls, enabledAlerts = [] }: DigestViewProps) {
  const t = c(isDark);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [data, setData] = useState<BriefsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({ category: activeCategory });
    if (forumUrls && forumUrls.length > 0) {
      params.set('forumUrls', forumUrls.join(','));
    }

    fetch(`/api/briefs?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: BriefsResponse) => {
        if (!cancelled) {
          setData(json);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [activeCategory, forumUrls]);

  const handleTopicSelect = (topic: BriefsTopic) => {
    if (!onSelectTopic) {
      // Fallback: open externally
      const url = topic.externalUrl || `${topic.forumUrl}/t/${topic.slug}/${topic.id}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    // For external sources without a forumUrl that the reader can handle, open in new tab
    if (topic.sourceType && topic.sourceType !== 'discourse' && topic.externalUrl) {
      window.open(topic.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    // Pass full DiscussionTopic to the reader — server already provides all fields
    onSelectTopic(topic);
  };

  const totalTopics = data ? data.hot.length + data.fresh.length : 0;

  // Derive Keyword matches and Delegate Corner from the existing hot/fresh pool
  const allTopics = useMemo(() => (data ? [...data.hot, ...data.fresh] : []), [data]);

  const keywordMatches = useMemo(() => {
    const active = enabledAlerts.filter((a) => a.isEnabled && a.keyword);
    if (active.length === 0 || allTopics.length === 0) return [] as BriefsTopic[];
    const seen = new Set<string>();
    const out: BriefsTopic[] = [];
    for (const topic of allTopics) {
      if (seen.has(topic.refId)) continue;
      if (active.some((a) => topicMatchesKeyword(topic, a.keyword))) {
        out.push(topic);
        seen.add(topic.refId);
      }
    }
    return out.slice(0, 10);
  }, [allTopics, enabledAlerts]);

  const delegateCorner = useMemo(() => {
    if (allTopics.length === 0) return [] as BriefsTopic[];
    const seen = new Set(keywordMatches.map((t) => t.refId));
    const out: BriefsTopic[] = [];
    for (const topic of allTopics) {
      if (seen.has(topic.refId)) continue;
      if (topicIsGovernance(topic)) {
        out.push(topic);
        seen.add(topic.refId);
      }
    }
    return out.slice(0, 8);
  }, [allTopics, keywordMatches]);

  return (
    <section className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" style={{ color: t.fg }}>
            <Newspaper className="w-5 h-5" />
            Briefs
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: t.fgMuted }}>
            Discover across communities
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-0.5 p-1 rounded-lg mb-4" style={{ backgroundColor: t.bgCard }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeCategory === cat.id ? t.bgActive : 'transparent',
                color: activeCategory === cat.id ? t.fg : t.fgMuted,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <BriefsSkeleton isDark={isDark} />
        ) : error ? (
          <div className="rounded-lg border p-6 text-center" style={{ borderColor: t.border }}>
            <AlertCircle className="w-6 h-6 mx-auto mb-2" style={{ color: t.fgMuted }} />
            <p className="text-sm" style={{ color: t.fgMuted }}>
              Failed to load briefs: {error}
            </p>
          </div>
        ) : data ? (
          <>
            {totalTopics === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: t.border }}>
                <Newspaper className="w-6 h-6 mx-auto mb-2" style={{ color: t.fgMuted }} />
                <p className="text-sm" style={{ color: t.fgMuted }}>
                  No discussions found. The forum cache may still be warming up.
                </p>
              </div>
            )}

            {/* Keyword matches (only when alerts are configured) */}
            {keywordMatches.length > 0 && (
              <>
                <SectionHeader icon={Target} title="Keyword matches" count={keywordMatches.length} isDark={isDark} />
                {keywordMatches.map((topic) => (
                  <div key={`kw-${topic.refId}`} className="mb-2">
                    <TopicCard topic={topic} onSelect={handleTopicSelect} isDark={isDark} />
                  </div>
                ))}
              </>
            )}

            {/* Delegate Corner — governance/grants-tagged threads */}
            {delegateCorner.length > 0 && (
              <>
                <SectionHeader icon={Vote} title="Delegate Corner" count={delegateCorner.length} isDark={isDark} />
                {delegateCorner.map((topic) => (
                  <div key={`dc-${topic.refId}`} className="mb-2">
                    <TopicCard topic={topic} onSelect={handleTopicSelect} isDark={isDark} />
                  </div>
                ))}
              </>
            )}

            {/* Trending */}
            <SectionHeader icon={TrendingUp} title="Trending" count={data.hot.length} isDark={isDark} />
            {data.hot.map((topic) => (
              <div key={topic.refId} className="mb-2">
                <TopicCard topic={topic} onSelect={handleTopicSelect} isDark={isDark} />
              </div>
            ))}

            {/* New */}
            <SectionHeader icon={Sparkles} title="New" count={data.fresh.length} isDark={isDark} />
            {data.fresh.map((topic) => (
              <div key={topic.refId} className="mb-2">
                <TopicCard topic={topic} onSelect={handleTopicSelect} isDark={isDark} />
              </div>
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}
