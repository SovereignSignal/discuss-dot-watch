'use client';

import { useState, useEffect } from 'react';
import { Newspaper, MessageSquare, Eye, ThumbsUp, TrendingUp, Sparkles, Users, Send, AlertCircle } from 'lucide-react';
import { DiscussionTopic } from '@/types';
import { useAuth } from './AuthProvider';
import { c } from '@/lib/theme';

interface TopicSummary {
  title: string;
  protocol: string;
  url: string;
  replies: number;
  views: number;
  likes: number;
  summary: string;
  sentiment?: 'positive' | 'neutral' | 'contentious';
  matchedKeywords?: string[];
}

interface DigestContent {
  period: 'daily' | 'weekly';
  startDate: string;
  endDate: string;
  hotTopics: TopicSummary[];
  newProposals: TopicSummary[];
  delegateCorner?: TopicSummary[];
  keywordMatches: TopicSummary[];
  overallSummary: string;
  stats: {
    totalDiscussions: number;
    totalReplies: number;
    mostActiveProtocol: string;
  };
}

interface DigestViewProps {
  onSelectTopic?: (topic: DiscussionTopic) => void;
  isDark?: boolean;
}

function TopicCard({
  topic,
  onSelect,
  isDark,
  matchedKeywords,
}: {
  topic: TopicSummary;
  onSelect?: (topic: TopicSummary) => void;
  isDark: boolean;
  matchedKeywords?: string[];
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
        {matchedKeywords && matchedKeywords.length > 0 && (
          matchedKeywords.map((kw) => (
            <span key={kw} className="px-1.5 py-0.5 text-[11px] font-medium rounded flex-shrink-0"
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: t.fgDim }}>
              {kw}
            </span>
          ))
        )}
      </div>

      <button
        onClick={() => onSelect?.(topic)}
        className="text-sm font-medium text-left hover:underline line-clamp-2"
        style={{ color: t.fg }}
      >
        {topic.title}
      </button>

      {topic.summary && (
        <p className="mt-1 text-[12px] leading-relaxed line-clamp-3" style={{ color: t.fgMuted }}>
          {topic.summary}
        </p>
      )}

      <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: t.fgDim }}>
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{topic.replies}</span>
        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{topic.views.toLocaleString()}</span>
        {topic.likes > 0 && <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{topic.likes}</span>}
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

function DigestSkeleton({ isDark }: { isDark: boolean }) {
  const t = c(isDark);
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded" style={{ backgroundColor: t.bgBadge }} />
      <div className="h-20 rounded-lg" style={{ backgroundColor: t.bgBadge }} />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg" style={{ backgroundColor: t.bgBadge }} />
        ))}
      </div>
    </div>
  );
}

export function DigestView({ onSelectTopic, isDark = true }: DigestViewProps) {
  const t = c(isDark);
  const { user } = useAuth();
  const [digest, setDigest] = useState<DigestContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'daily' | 'weekly'>('weekly');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({ format: 'json', period });
    if (user?.id) params.set('privyDid', user.id);

    fetch(`/api/digest?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setDigest(data.digest);
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
  }, [period, user?.id]);

  const handleTopicSelect = (topic: TopicSummary) => {
    if (!onSelectTopic) {
      window.open(topic.url, '_blank', 'noopener,noreferrer');
      return;
    }
    // Build a minimal DiscussionTopic for the reader
    // Extract forumUrl and topicId from the URL
    const urlParts = topic.url.match(/^(https?:\/\/[^/]+)\/t\/[^/]+\/(\d+)/);
    if (urlParts) {
      const forumUrl = urlParts[1];
      const topicId = parseInt(urlParts[2], 10);
      const slug = topic.url.split('/t/')[1]?.split('/')[0] || '';
      onSelectTopic({
        id: topicId,
        refId: `${topic.protocol.toLowerCase().replace(/\s+/g, '-')}-${topicId}`,
        protocol: topic.protocol,
        title: topic.title,
        slug,
        tags: [],
        postsCount: topic.replies,
        views: topic.views,
        replyCount: topic.replies,
        likeCount: topic.likes,
        categoryId: 0,
        pinned: false,
        visible: true,
        closed: false,
        archived: false,
        createdAt: '',
        bumpedAt: '',
        forumUrl,
      });
    } else {
      window.open(topic.url, '_blank', 'noopener,noreferrer');
    }
  };

  const totalTopics = digest
    ? digest.keywordMatches.length + digest.newProposals.length + digest.hotTopics.length + (digest.delegateCorner?.length || 0)
    : 0;

  return (
    <section className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2" style={{ color: t.fg }}>
              <Newspaper className="w-5 h-5" />
              Briefs
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: t.fgMuted }}>
              AI-powered digest of community discussions
            </p>
          </div>

          {/* Period toggle */}
          <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ backgroundColor: t.bgCard }}>
            {(['daily', 'weekly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize"
                style={{
                  backgroundColor: period === p ? t.bgActive : 'transparent',
                  color: period === p ? t.fg : t.fgMuted,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <DigestSkeleton isDark={isDark} />
        ) : error ? (
          <div className="rounded-lg border p-6 text-center" style={{ borderColor: t.border }}>
            <AlertCircle className="w-6 h-6 mx-auto mb-2" style={{ color: t.fgMuted }} />
            <p className="text-sm" style={{ color: t.fgMuted }}>
              {error === 'HTTP 500' ? 'Digest is being generated. Check back soon.' : `Failed to load briefs: ${error}`}
            </p>
          </div>
        ) : digest ? (
          <>
            {/* Summary card */}
            <div
              className="rounded-lg border p-4 mb-4"
              style={{ borderColor: t.border, backgroundColor: t.bgCard }}
            >
              <p className="text-sm leading-relaxed" style={{ color: t.fgSecondary }}>
                {digest.overallSummary}
              </p>
              <div className="mt-3 flex items-center gap-4 text-[12px]" style={{ color: t.fgDim }}>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {digest.stats.totalDiscussions} discussions
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {digest.stats.totalReplies.toLocaleString()} replies
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {digest.stats.mostActiveProtocol}
                </span>
              </div>
            </div>

            {totalTopics === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: t.border }}>
                <Newspaper className="w-6 h-6 mx-auto mb-2" style={{ color: t.fgMuted }} />
                <p className="text-sm" style={{ color: t.fgMuted }}>
                  No discussions found for this period. Try switching to weekly.
                </p>
              </div>
            )}

            {/* Keyword Matches */}
            <SectionHeader icon={AlertCircle} title="Keyword Matches" count={digest.keywordMatches.length} isDark={isDark} />
            {digest.keywordMatches.map((topic, i) => (
              <div key={i} className="mb-2">
                <TopicCard topic={topic} onSelect={handleTopicSelect} isDark={isDark} matchedKeywords={topic.matchedKeywords} />
              </div>
            ))}

            {/* New Conversations */}
            <SectionHeader icon={Sparkles} title="New Conversations" count={digest.newProposals.length} isDark={isDark} />
            {digest.newProposals.map((topic, i) => (
              <div key={i} className="mb-2">
                <TopicCard topic={topic} onSelect={handleTopicSelect} isDark={isDark} />
              </div>
            ))}

            {/* Trending */}
            <SectionHeader icon={TrendingUp} title="Trending" count={digest.hotTopics.length} isDark={isDark} />
            {digest.hotTopics.map((topic, i) => (
              <div key={i} className="mb-2">
                <TopicCard topic={topic} onSelect={handleTopicSelect} isDark={isDark} />
              </div>
            ))}

            {/* Delegate Corner */}
            {digest.delegateCorner && digest.delegateCorner.length > 0 && (
              <>
                <SectionHeader icon={Users} title="Delegate Corner" count={digest.delegateCorner.length} isDark={isDark} />
                {digest.delegateCorner.map((topic, i) => (
                  <div key={i} className="mb-2">
                    <TopicCard topic={topic} onSelect={handleTopicSelect} isDark={isDark} />
                  </div>
                ))}
              </>
            )}

            {/* Send to email hint */}
            {user?.email && (
              <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: t.border }}>
                <p className="text-[12px]" style={{ color: t.fgDim }}>
                  <Send className="w-3 h-3 inline mr-1" />
                  Want this in your inbox? Set up email digests in Settings.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
