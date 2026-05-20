'use client';

import { useMemo } from 'react';
import {
  ChevronRight,
  Users,
  Activity,
  MessageSquare,
  ThumbsUp,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Target,
  Pin,
  ExternalLink,
  Eye,
} from 'lucide-react';
import type { DelegateDashboard, DelegateRow, DashboardSummary, TenantSnapshotData, GovernanceScore, DashboardPeriod, FeaturedThread, DelegateActivityThread } from '@/types/delegates';
import type { c } from '@/lib/theme';
import type { BrandedColorsResult } from './dashboardUtils';
import { getPostCountForPeriod, getGcrTier } from './dashboardUtils';
import { formatDistanceToNow } from 'date-fns';
import { GovScorePill } from './GovScorePill';
import { VerifiedDelegatesProgramCard } from './VerifiedDelegatesProgramCard';
import { GovernanceLeaderboard } from './GovernanceLeaderboard';
import { SnapshotSummaryCard } from './SnapshotSummaryCard';

export { GovScorePill };

interface OverviewTabProps {
  dashboard: DelegateDashboard;
  filteredDelegates?: DelegateRow[];
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
  onSelectDelegate: (username: string) => void;
  snapshotData?: TenantSnapshotData | null;
  governanceScores?: GovernanceScore[];
  period?: DashboardPeriod;
  filterMode?: 'all' | 'verified';
  featuredThreads?: FeaturedThread[];
  delegateActivityThreads?: DelegateActivityThread[];
}

export default function OverviewTab({
  dashboard,
  filteredDelegates,
  t,
  bc,
  isMobile,
  onSelectDelegate,
  snapshotData,
  governanceScores,
  period = 'year',
  filterMode = 'all',
  featuredThreads = [],
  delegateActivityThreads = [],
}: OverviewTabProps) {
  const summary = dashboard.summary;
  const delegates = filteredDelegates ?? dashboard.delegates;
  const isVerifiedView = filterMode === 'verified';

  // Scope governance scores to current view
  const filteredGovScores = useMemo(() => {
    if (!governanceScores || governanceScores.length === 0) return [];
    if (!filteredDelegates) return governanceScores;
    const usernames = new Set(delegates.map(d => d.username));
    return governanceScores.filter(g => usernames.has(g.username));
  }, [governanceScores, delegates, filteredDelegates]);

  const avgGovScore = useMemo(() => {
    if (filteredGovScores.length === 0) return null;
    const sum = filteredGovScores.reduce((s, g) => s + g.combinedScore, 0);
    return Math.round(sum / filteredGovScores.length);
  }, [filteredGovScores]);

  // Compute period-aware activity distribution client-side
  const periodDistribution = useMemo(() => {
    if (period === 'all' && filterMode === 'all') return summary.activityDistribution;
    // Compute from delegates using period post counts
    const thresholds = period === 'week'
      ? { high: 10, active: 3, low: 1, minimal: 0 }
      : period === 'month'
        ? { high: 20, active: 5, low: 2, minimal: 1 }
        : { high: 50, active: 11, low: 2, minimal: 1 }; // year

    return {
      highlyActive: delegates.filter(d => getPostCountForPeriod(d, period) >= thresholds.high).length,
      active: delegates.filter(d => {
        const pc = getPostCountForPeriod(d, period);
        return pc >= thresholds.active && pc < thresholds.high;
      }).length,
      lowActivity: delegates.filter(d => {
        const pc = getPostCountForPeriod(d, period);
        return pc >= thresholds.low && pc < thresholds.active;
      }).length,
      minimal: period === 'week'
        ? 0 // week has no minimal tier
        : delegates.filter(d => getPostCountForPeriod(d, period) === thresholds.minimal).length,
      dormant: delegates.filter(d => getPostCountForPeriod(d, period) === 0).length,
    };
  }, [delegates, period, summary.activityDistribution, filterMode]);

  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : period === 'year' ? 'This Year' : '';

  // Period-aware post total + active count for KeyStatsRow
  const periodPostTotal = useMemo(() => {
    return delegates.reduce((s, d) => s + getPostCountForPeriod(d, period), 0);
  }, [delegates, period]);

  const periodActiveContributors = useMemo(() => {
    return delegates.filter(d => getPostCountForPeriod(d, period) > 0).length;
  }, [delegates, period]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
      {/* Verified Delegates Program Card */}
      {isVerifiedView && (
        <VerifiedDelegatesProgramCard
          delegates={delegates}
          governanceScores={filteredGovScores}
          period={period}
          t={t}
          bc={bc}
          isMobile={isMobile}
          onSelectDelegate={onSelectDelegate}
        />
      )}

      {/* Delegate Activity Threads (verified view only) */}
      {isVerifiedView && delegateActivityThreads.length > 0 && (
        <DelegateActivityThreadsCard
          threads={delegateActivityThreads}
          t={t}
          bc={bc}
          isMobile={isMobile}
        />
      )}

      {/* AI Brief (hidden in verified view) */}
      {!isVerifiedView && <AIBriefCard brief={dashboard.brief} t={t} bc={bc} isMobile={isMobile} />}

      {/* Featured Threads (hidden in verified view) */}
      {!isVerifiedView && featuredThreads.length > 0 && (
        <FeaturedThreadsCard
          threads={featuredThreads}
          forumUrl={dashboard.tenant.forumUrl}
          t={t}
          bc={bc}
          isMobile={isMobile}
        />
      )}

      {/* Key Metrics */}
      <KeyStatsRow
        summary={summary}
        t={t}
        accent={bc?.accent}
        isMobile={isMobile}
        avgGovScore={avgGovScore}
        period={period}
        periodPostTotal={periodPostTotal}
        periodActiveContributors={periodActiveContributors}
        totalOverride={filterMode !== 'all' ? delegates.length : undefined}
      />

      {isMobile ? (
        <>
          <ActivityBar
            distribution={periodDistribution}
            total={delegates.length}
            t={t}
            isMobile={isMobile}
            periodLabel={period !== 'all' ? periodLabel : undefined}
          />
          <ParticipationFunnel
            delegates={delegates}
            summary={summary}
            t={t}
            isMobile={isMobile}
            accent={bc?.accent}
          />
          <GovernanceLeaderboard
            delegates={delegates}
            governanceScores={filteredGovScores}
            t={t}
            bc={bc}
            isMobile={isMobile}
            onSelect={onSelectDelegate}
            period={period}
          />
          {snapshotData && (
            <SnapshotSummaryCard data={snapshotData} t={t} bc={bc} isMobile={isMobile} delegates={delegates} />
          )}
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: 24 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <ActivityBar
              distribution={periodDistribution}
              total={delegates.length}
              t={t}
              isMobile={isMobile}
              periodLabel={period !== 'all' ? periodLabel : undefined}
            />
            <ParticipationFunnel
              delegates={delegates}
              summary={summary}
              t={t}
              isMobile={isMobile}
              accent={bc?.accent}
            />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <GovernanceLeaderboard
              delegates={delegates}
              governanceScores={filteredGovScores}
              t={t}
              bc={bc}
              isMobile={isMobile}
              onSelect={onSelectDelegate}
              period={period}
            />
            {snapshotData && (
              <SnapshotSummaryCard data={snapshotData} t={t} bc={bc} isMobile={isMobile} delegates={delegates} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AIBriefCard({
  brief,
  t,
  bc,
  isMobile,
}: {
  brief?: string | null;
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        padding: isMobile ? '16px' : '20px 24px',
        borderRadius: 12,
        border: `1px solid ${bc?.accentBorder || t.border}`,
        background: bc?.accentBg || t.bgCard,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sparkles size={15} color={bc?.accent || t.fgMuted} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Activity Snapshot</span>
      </div>
      {brief ? (
        <div style={{ fontSize: 14, lineHeight: 1.7, color: t.fgMuted, whiteSpace: 'pre-line' }}>
          {brief}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: t.fgDim, fontStyle: 'italic' }}>
          Activity snapshot is being generated and will appear on next page load.
        </div>
      )}
      <div style={{ fontSize: 10, color: t.fgDim, marginTop: 10 }}>
        AI-generated snapshot based on forum directory data
      </div>
    </div>
  );
}

function KeyStatsRow({
  summary,
  t,
  accent,
  isMobile,
  avgGovScore,
  period = 'year',
  periodPostTotal = 0,
  periodActiveContributors = 0,
  totalOverride,
}: {
  summary: DashboardSummary;
  t: ReturnType<typeof c>;
  accent?: string;
  isMobile: boolean;
  avgGovScore: number | null;
  period?: DashboardPeriod;
  periodPostTotal?: number;
  periodActiveContributors?: number;
  totalOverride?: number;
}) {
  const total = totalOverride ?? summary.totalDelegates;
  const periodLabels: Record<DashboardPeriod, string> = {
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    all: '',
  };

  const activeLabel = period === 'all' ? 'Active (30d)' : `Active ${periodLabels[period]}`;
  const activeCount = period === 'all'
    ? (totalOverride != null ? periodActiveContributors : (summary.hasMonthlyData ? (summary.monthlyActiveContributors ?? 0) : summary.delegatesPostedLast30Days))
    : periodActiveContributors;
  const activeRate = total > 0
    ? Math.round((activeCount / total) * 100)
    : 0;

  const postsLabel = period === 'all'
    ? (avgGovScore != null ? 'Avg Gov Score' : 'Median Posts')
    : (avgGovScore != null ? 'Avg Gov Score' : `Posts ${periodLabels[period]}`);
  const postsValue = avgGovScore != null
    ? avgGovScore
    : (period === 'all' ? (summary.medianPostCount ?? 0) : periodPostTotal);

  const cards = [
    { label: totalOverride != null ? 'Members' : 'Total Contributors', value: total, icon: Users },
    { label: activeLabel, value: activeCount, icon: Activity },
    { label: postsLabel, value: postsValue, icon: avgGovScore != null ? Target : MessageSquare },
    { label: 'Active Rate', value: `${activeRate}%`, icon: TrendingUp },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: isMobile ? 8 : 12,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            padding: isMobile ? '14px 14px' : '18px 20px',
            borderRadius: 12,
            border: `1px solid ${t.border}`,
            background: t.bgCard,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <card.icon size={14} color={accent || t.fgDim} />
            <span style={{ fontSize: 12, color: t.fgDim }}>{card.label}</span>
          </div>
          <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700 }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function ActivityBar({
  distribution,
  total,
  t,
  isMobile,
  periodLabel,
}: {
  distribution: DashboardSummary['activityDistribution'];
  total: number;
  t: ReturnType<typeof c>;
  isMobile: boolean;
  periodLabel?: string;
}) {
  if (!distribution || total === 0) return null;

  const tiers = [
    { label: 'Highly Active', count: distribution.highlyActive, color: '#10b981' },
    { label: 'Active', count: distribution.active, color: '#3b82f6' },
    { label: 'Low Activity', count: distribution.lowActivity, color: '#f59e0b' },
    { label: 'Minimal', count: distribution.minimal, color: '#f97316' },
    { label: 'Dormant', count: distribution.dormant, color: '#ef4444' },
  ];

  return (
    <div
      style={{
        padding: isMobile ? '14px 14px' : '18px 20px',
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
        Activity Distribution{periodLabel ? ` (${periodLabel})` : ''}
      </div>

      {/* Stacked bar */}
      <div
        style={{
          display: 'flex',
          height: 28,
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {tiers.map((tier) => {
          const pct = (tier.count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={tier.label}
              title={`${tier.label}: ${tier.count} (${Math.round(pct)}%)`}
              style={{
                width: `${pct}%`,
                background: tier.color,
                minWidth: pct > 0 ? 2 : 0,
                transition: 'width 0.3s',
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '6px 12px' : '6px 20px' }}>
        {tiers.map((tier) => (
          <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: tier.color, flexShrink: 0 }} />
            <span style={{ color: t.fgMuted }}>{tier.label}</span>
            <span style={{ color: t.fgDim, fontWeight: 500 }}>{tier.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParticipationFunnel({
  delegates,
  summary,
  t,
  isMobile,
  accent,
}: {
  delegates: DelegateRow[];
  summary: DashboardSummary;
  t: ReturnType<typeof c>;
  isMobile: boolean;
  accent?: string;
}) {
  const total = summary.totalDelegates;
  const tracked = delegates.filter(d => d.isTracked).length;
  const withWallets = delegates.filter(d => d.walletAddress).length;
  const withVotes = delegates.filter(d => (d.voteRate ?? 0) > 0 || (d.votesCast ?? 0) > 0).length;

  if (total === 0) return null;

  const steps = [
    { label: 'Total Contributors', count: total, color: accent || '#3b82f6' },
    { label: 'Tracked / Verified', count: tracked, color: '#8b5cf6' },
    { label: 'Wallet Linked', count: withWallets, color: '#06b6d4' },
    { label: 'Have Voted', count: withVotes, color: '#10b981' },
  ];

  return (
    <div
      style={{
        padding: isMobile ? '14px 14px' : '18px 20px',
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Participation Funnel</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((step) => {
          const pct = total > 0 ? (step.count / total) * 100 : 0;
          return (
            <div key={step.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: t.fgMuted }}>{step.label}</span>
                <span style={{ color: t.fg, fontWeight: 600 }}>{step.count}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: t.bgSubtle, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                    background: step.color,
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Featured Threads Card ---

function FeaturedThreadsCard({
  threads,
  forumUrl,
  t,
  bc,
  isMobile,
}: {
  threads: FeaturedThread[];
  forumUrl: string;
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
}) {
  const accent = bc?.accent || '#3b82f6';
  const display = threads.slice(0, 5);

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        padding: isMobile ? 14 : 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Pin size={15} style={{ color: accent }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.fg }}>Featured Threads</span>
        <span style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          background: `${accent}18`,
          color: accent,
          border: `1px solid ${accent}33`,
        }}>
          {threads.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {display.map((thread) => (
          <a
            key={thread.topicId}
            href={`${forumUrl.replace(/\/$/, '')}/t/${thread.slug}/${thread.topicId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: isMobile ? 8 : 10,
              padding: '8px 10px',
              borderRadius: 8,
              textDecoration: 'none',
              color: t.fg,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = bc?.accentHover || t.bgSubtle; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {thread.authorAvatarUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={thread.authorAvatarUrl}
                alt=""
                width={24}
                height={24}
                style={{ borderRadius: '50%', flexShrink: 0, marginTop: isMobile ? 2 : 0 }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {thread.title}
              </div>
              {!isMobile && thread.excerpt && (
                <div style={{
                  fontSize: 11,
                  color: t.fgDim,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: 2,
                }}>
                  {thread.excerpt}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexShrink: 0, fontSize: 11, color: t.fgDim }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <MessageSquare size={11} />
                {thread.replyCount}
              </span>
              {!isMobile && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Eye size={11} />
                  {thread.views}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <ThumbsUp size={11} />
                {thread.likeCount}
              </span>
              <ExternalLink size={11} style={{ color: t.fgDim }} />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// --- Delegate Activity Threads Card ---

function DelegateActivityThreadsCard({
  threads,
  t,
  bc,
  isMobile,
}: {
  threads: DelegateActivityThread[];
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
}) {
  const accent = bc?.accent || '#3b82f6';

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        padding: isMobile ? 14 : 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <MessageSquare size={15} style={{ color: accent }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.fg }}>Active Delegate Discussions</span>
        <span style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          background: `${accent}18`,
          color: accent,
          border: `1px solid ${accent}33`,
        }}>
          {threads.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {threads.map((thread) => (
          <a
            key={thread.topicId}
            href={`${thread.forumUrl.replace(/\/$/, '')}/t/${thread.topicSlug}/${thread.topicId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              textDecoration: 'none',
              color: t.fg,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = bc?.accentHover || t.bgSubtle; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Stacked delegate avatars */}
            <div style={{ display: 'flex', flexShrink: 0 }}>
              {thread.participatingDelegates.slice(0, 5).map((d, i) => (
                d.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={d.username}
                    src={d.avatarUrl}
                    alt={d.displayName}
                    title={d.displayName}
                    width={22}
                    height={22}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: `2px solid ${t.bgCard}`,
                      marginLeft: i > 0 ? -8 : 0,
                      position: 'relative',
                      zIndex: 5 - i,
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    key={d.username}
                    title={d.displayName}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: t.bgActive,
                      border: `2px solid ${t.bgCard}`,
                      marginLeft: i > 0 ? -8 : 0,
                      position: 'relative',
                      zIndex: 5 - i,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    {d.displayName?.[0] || '?'}
                  </div>
                )
              ))}
              {thread.participatingDelegates.length > 5 && (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: t.bgActive,
                    border: `2px solid ${t.bgCard}`,
                    marginLeft: -8,
                    position: 'relative',
                    zIndex: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 600,
                    color: t.fgDim,
                  }}
                >
                  +{thread.participatingDelegates.length - 5}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {thread.topicTitle}
              </div>
              <div style={{ fontSize: 11, color: t.fgDim, marginTop: 2 }}>
                {thread.participatingDelegates.length} delegate{thread.participatingDelegates.length !== 1 ? 's' : ''} &middot; {thread.totalDelegatePosts} post{thread.totalDelegatePosts !== 1 ? 's' : ''} &middot; {formatDistanceToNow(new Date(thread.latestActivityAt), { addSuffix: true })}
              </div>
            </div>
            <ExternalLink size={12} style={{ color: t.fgDim, flexShrink: 0 }} />
          </a>
        ))}
      </div>
    </div>
  );
}

