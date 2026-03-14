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
  AlertTriangle,
  Vote,
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

interface OverviewTabProps {
  dashboard: DelegateDashboard;
  filteredDelegates?: DelegateRow[];
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
  onSelectDelegate: (username: string) => void;
  hasTracked: boolean;
  trackedLabelPlural: string;
  snapshotData?: TenantSnapshotData | null;
  governanceScores?: GovernanceScore[];
  period?: DashboardPeriod;
  filterMode?: 'all' | 'tracked' | 'verified';
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
  hasTracked,
  trackedLabelPlural,
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

// ============================================================
// Sub-components
// ============================================================

function VerifiedDelegatesProgramCard({
  delegates,
  governanceScores,
  period,
  t,
  bc,
  isMobile,
  onSelectDelegate,
}: {
  delegates: DelegateRow[];
  governanceScores: GovernanceScore[];
  period: DashboardPeriod;
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
  onSelectDelegate: (username: string) => void;
}) {
  const accent = bc?.accent || '#22c55e';
  const totalVerified = delegates.length;

  const scoreMap = useMemo(() => {
    const m = new Map<string, GovernanceScore>();
    for (const s of governanceScores) m.set(s.username, s);
    return m;
  }, [governanceScores]);

  const activeThisPeriod = useMemo(
    () => delegates.filter(d => getPostCountForPeriod(d, period) > 0).length,
    [delegates, period]
  );

  const avgScore = useMemo(() => {
    if (governanceScores.length === 0) return null;
    return Math.round(governanceScores.reduce((s, g) => s + g.combinedScore, 0) / governanceScores.length);
  }, [governanceScores]);

  const rationaleRate = useMemo(() => {
    if (totalVerified === 0) return 0;
    return Math.round((delegates.filter(d => d.rationaleCount > 0).length / totalVerified) * 100);
  }, [delegates, totalVerified]);

  const avgForumScore = useMemo(() => {
    if (governanceScores.length === 0) return null;
    return Math.round(governanceScores.reduce((s, g) => s + g.forumScore, 0) / governanceScores.length);
  }, [governanceScores]);

  // Compliance: 80%+ voting and 60+ gov score
  const compliance = useMemo(() => {
    const meetVoting = delegates.filter(d => {
      const gs = scoreMap.get(d.username);
      return gs && gs.breakdown.voteRate >= 80;
    }).length;
    const meetScore = delegates.filter(d => {
      const gs = scoreMap.get(d.username);
      return gs && gs.combinedScore >= 60;
    }).length;
    return { meetVoting, meetScore };
  }, [delegates, scoreMap]);

  // At-risk: no posts in period or no rationales
  const atRisk = useMemo(() => {
    return delegates
      .filter(d => getPostCountForPeriod(d, period) === 0 || d.rationaleCount === 0)
      .sort((a, b) => getPostCountForPeriod(a, period) - getPostCountForPeriod(b, period))
      .slice(0, 5);
  }, [delegates, period]);

  const periodLabels: Record<DashboardPeriod, string> = {
    week: 'this week', month: 'this month', year: 'this year', all: '',
  };

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${accent}33`,
        background: `${accent}08`,
        padding: isMobile ? 14 : 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <CheckCircle2 size={16} style={{ color: accent }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: t.fg }}>Verified Delegates</span>
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 9999,
          background: `${accent}18`,
          color: accent,
          border: `1px solid ${accent}33`,
          fontWeight: 600,
        }}>
          {totalVerified} members
        </span>
      </div>

      {/* Health Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
        gap: isMobile ? 8 : 10,
        marginBottom: 16,
      }}>
        <MetricBox
          label={period === 'all' ? 'Active (30d)' : `Active ${periodLabels[period]}`}
          value={`${totalVerified > 0 ? Math.round((activeThisPeriod / totalVerified) * 100) : 0}%`}
          sub={`${activeThisPeriod} of ${totalVerified}`}
          color={activeThisPeriod / totalVerified >= 0.8 ? '#10b981' : activeThisPeriod / totalVerified >= 0.5 ? '#f59e0b' : '#ef4444'}
          t={t}
        />
        <MetricBox
          label="Avg Gov Score"
          value={avgScore != null ? String(avgScore) : '\u2014'}
          sub={avgScore != null ? getGcrTier(avgScore).label : undefined}
          color={avgScore != null ? getGcrTier(avgScore).color : t.fgDim}
          t={t}
        />
        <MetricBox
          label="Rationale Rate"
          value={`${rationaleRate}%`}
          sub="with rationales"
          color={rationaleRate >= 80 ? '#10b981' : rationaleRate >= 50 ? '#f59e0b' : '#ef4444'}
          t={t}
        />
        <MetricBox
          label="Forum Engagement"
          value={avgForumScore != null ? String(avgForumScore) : '\u2014'}
          sub="avg forum score"
          color={avgForumScore != null && avgForumScore >= 50 ? '#10b981' : '#f59e0b'}
          t={t}
        />
      </div>

      {/* Compliance Bar */}
      {governanceScores.length > 0 && (
        <div style={{ marginBottom: atRisk.length > 0 ? 16 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.fgMuted, marginBottom: 8 }}>Compliance</div>
          <div style={{ display: 'flex', gap: isMobile ? 8 : 12 }}>
            <ComplianceBar
              label="80%+ Voting"
              count={compliance.meetVoting}
              total={totalVerified}
              color="#10b981"
              t={t}
            />
            <ComplianceBar
              label="60+ Gov Score"
              count={compliance.meetScore}
              total={totalVerified}
              color="#3b82f6"
              t={t}
            />
          </div>
        </div>
      )}

      {/* At-Risk Delegates */}
      {atRisk.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>
              At-Risk ({atRisk.length})
            </span>
            <span style={{ fontSize: 11, color: t.fgDim }}>
              no posts {period !== 'all' ? periodLabels[period] : ''} or missing rationales
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {atRisk.map(d => (
              <div
                key={d.username}
                onClick={() => onSelectDelegate(d.username)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDelegate(d.username); } }}
                tabIndex={0}
                role="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  fontSize: 12,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {d.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={d.avatarUrl} alt="" width={20} height={20} style={{ borderRadius: '50%', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: t.bgActive, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    {d.displayName?.[0] || '?'}
                  </div>
                )}
                <span style={{ fontWeight: 500, color: t.fg, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.displayName}
                </span>
                <span style={{ color: t.fgDim, flexShrink: 0 }}>
                  {getPostCountForPeriod(d, period)} posts, {d.rationaleCount} rationales
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({
  label,
  value,
  sub,
  color,
  t,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  t: ReturnType<typeof c>;
}) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: t.bgCard, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 10, color: t.fgDim, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: t.fgDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ComplianceBar({
  label,
  count,
  total,
  color,
  t,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  t: ReturnType<typeof c>;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: t.fgMuted }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{count}/{total} ({pct}%)</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: t.bgSubtle, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function SnapshotSummaryCard({
  data,
  t,
  bc,
  isMobile,
  delegates,
}: {
  data: TenantSnapshotData;
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
  delegates: DelegateRow[];
}) {
  const accent = bc?.accent || '#3b82f6';
  const activeProposals = data.proposals.filter((p) => p.state === 'active');
  const delegatesWithWallets = delegates.filter(d => d.isTracked && d.walletAddress).length;

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
        <Vote size={16} style={{ color: accent }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.fg }}>Snapshot Voting</span>
        <span style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          background: `${accent}18`,
          color: accent,
          border: `1px solid ${accent}33`,
        }}>
          {data.space}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginBottom: activeProposals.length > 0 || delegatesWithWallets > 0 ? 12 : 0,
        }}
      >
        <div style={{ padding: 8, borderRadius: 8, background: t.bgSubtle }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: accent }}>{data.totalProposals}</div>
          <div style={{ fontSize: 10, color: t.fgMuted }}>Proposals</div>
        </div>
        <div style={{ padding: 8, borderRadius: 8, background: t.bgSubtle }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{data.activeProposals}</div>
          <div style={{ fontSize: 10, color: t.fgMuted }}>Active</div>
        </div>
        <div style={{ padding: 8, borderRadius: 8, background: t.bgSubtle }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.fgSecondary }}>{data.avgVoterParticipation}</div>
          <div style={{ fontSize: 10, color: t.fgMuted }}>Avg Voters</div>
        </div>
      </div>

      {delegatesWithWallets > 0 && (
        <div style={{
          fontSize: 12,
          color: t.fgMuted,
          padding: '6px 8px',
          borderRadius: 6,
          background: t.bgSubtle,
          marginBottom: activeProposals.length > 0 ? 8 : 0,
        }}>
          {delegatesWithWallets} tracked delegate{delegatesWithWallets !== 1 ? 's' : ''} with linked wallets
        </div>
      )}

      {activeProposals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeProposals.slice(0, 3).map((p) => (
            <a
              key={p.id}
              href={p.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                background: t.bgSubtle,
                textDecoration: 'none',
                color: t.fg,
                fontSize: 12,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.bgActive; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = t.bgSubtle; }}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#22c55e',
                flexShrink: 0,
              }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title}
              </span>
              <span style={{ color: t.fgDim, fontSize: 11, flexShrink: 0 }}>
                {p.votes} votes
              </span>
            </a>
          ))}
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

function GovernanceLeaderboard({
  delegates,
  governanceScores,
  t,
  bc,
  isMobile,
  onSelect,
  period = 'year',
}: {
  delegates: DelegateRow[];
  governanceScores?: GovernanceScore[];
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
  onSelect: (username: string) => void;
  period?: DashboardPeriod;
}) {
  const scoreMap = useMemo(() => {
    if (!governanceScores) return null;
    const m = new Map<string, GovernanceScore>();
    for (const s of governanceScores) m.set(s.username, s);
    return m;
  }, [governanceScores]);

  const top5 = useMemo(() => {
    // If governance scores available, sort by combined score
    if (scoreMap && scoreMap.size > 0) {
      return [...delegates]
        .sort((a, b) => {
          const sa = scoreMap.get(a.username)?.combinedScore ?? 0;
          const sb = scoreMap.get(b.username)?.combinedScore ?? 0;
          return sb - sa;
        })
        .slice(0, 5);
    }
    // Always rank by monthly (last 30 days) activity for relevance
    return [...delegates]
      .filter((d) => (d.postCountMonth ?? 0) > 0)
      .sort((a, b) => (b.postCountMonth ?? 0) - (a.postCountMonth ?? 0))
      .slice(0, 5);
  }, [delegates, scoreMap]);

  if (top5.length === 0) {
    return (
      <div
        style={{
          padding: isMobile ? '14px 14px' : '18px 20px',
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          background: t.bgCard,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Most Active (30 Days)</div>
        <div style={{ fontSize: 13, color: t.fgDim }}>No contributors posted this month.</div>
      </div>
    );
  }

  const useGovScore = scoreMap && scoreMap.size > 0;
  const title = useGovScore ? 'Governance Leaderboard' : 'Most Active (30 Days)';

  return (
    <div
      style={{
        padding: isMobile ? '14px 14px' : '18px 20px',
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {top5.map((d, i) => {
          const score = scoreMap?.get(d.username);
          const postDisplay = d.postCountMonth ?? 0;
          return (
            <div
              key={d.username}
              onClick={() => onSelect(d.username)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.username); } }}
              tabIndex={0}
              role="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = bc?.accentHover || t.bgSubtle; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 12, color: t.fgDim, width: 18, textAlign: 'center', fontWeight: 600 }}>
                {i + 1}
              </span>
              {d.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={d.avatarUrl} alt="" width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: t.bgActive,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {d.displayName?.[0] || '?'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {d.displayName}
                  {d.verifiedStatus && (
                    <CheckCircle2 size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
                  )}
                </div>
                <div style={{ fontSize: 11, color: t.fgDim }}>@{d.username}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {useGovScore && score ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GovScorePill score={score.combinedScore} />
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {postDisplay.toLocaleString()} post{postDisplay !== 1 ? 's' : ''}
                      <span style={{ fontSize: 10, color: t.fgDim, fontWeight: 400 }}> this month</span>
                    </div>
                    {d.postCountPercentile != null && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 9999,
                          background: '#10b98115',
                          border: '1px solid #10b98133',
                          color: '#10b981',
                        }}
                      >
                        top {100 - d.postCountPercentile}%
                      </span>
                    )}
                  </>
                )}
              </div>
              <ChevronRight size={14} color={t.fgDim} style={{ flexShrink: 0 }} />
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

// --- Shared pill component ---

export function GovScorePill({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const color = score >= 60 ? '#10b981' : score >= 30 ? '#f59e0b' : '#ef4444';
  const fontSize = size === 'md' ? 12 : 11;
  const padding = size === 'md' ? '3px 10px' : '2px 8px';
  return (
    <span
      style={{
        fontSize,
        fontWeight: 700,
        padding,
        borderRadius: 9999,
        background: `${color}15`,
        border: `1px solid ${color}33`,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {score}
    </span>
  );
}
