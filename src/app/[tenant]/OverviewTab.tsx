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
} from 'lucide-react';
import type { DelegateDashboard, DelegateRow, DashboardSummary, TenantSnapshotData, GovernanceScore } from '@/types/delegates';
import type { c } from '@/lib/theme';
import type { BrandedColorsResult } from './dashboardUtils';
import { formatDistanceToNow } from 'date-fns';

interface OverviewTabProps {
  dashboard: DelegateDashboard;
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
  onSelectDelegate: (username: string) => void;
  hasTracked: boolean;
  trackedLabelPlural: string;
  snapshotData?: TenantSnapshotData | null;
  governanceScores?: GovernanceScore[];
}

export default function OverviewTab({
  dashboard,
  t,
  bc,
  isMobile,
  onSelectDelegate,
  hasTracked,
  trackedLabelPlural,
  snapshotData,
  governanceScores,
}: OverviewTabProps) {
  const summary = dashboard.summary;
  const delegates = dashboard.delegates;

  const avgGovScore = useMemo(() => {
    if (!governanceScores || governanceScores.length === 0) return null;
    const sum = governanceScores.reduce((s, g) => s + g.combinedScore, 0);
    return Math.round(sum / governanceScores.length);
  }, [governanceScores]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
      {/* AI Brief */}
      <AIBriefCard brief={dashboard.brief} t={t} bc={bc} isMobile={isMobile} />

      {/* Key Metrics */}
      <KeyStatsRow summary={summary} t={t} accent={bc?.accent} isMobile={isMobile} avgGovScore={avgGovScore} />

      {isMobile ? (
        <>
          <ActivityBar
            distribution={summary.hasMonthlyData && summary.monthlyActivityDistribution ? summary.monthlyActivityDistribution : summary.activityDistribution}
            total={summary.totalDelegates}
            t={t}
            isMobile={isMobile}
            isMonthly={!!summary.hasMonthlyData}
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
            governanceScores={governanceScores}
            t={t}
            bc={bc}
            isMobile={isMobile}
            onSelect={onSelectDelegate}
            hasMonthlyData={!!summary.hasMonthlyData}
          />
          <AttentionNeededCard
            delegates={delegates}
            hasTracked={hasTracked}
            trackedLabelPlural={trackedLabelPlural}
            t={t}
            isMobile={isMobile}
            onSelect={onSelectDelegate}
            hasMonthlyData={!!summary.hasMonthlyData}
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
              distribution={summary.hasMonthlyData && summary.monthlyActivityDistribution ? summary.monthlyActivityDistribution : summary.activityDistribution}
              total={summary.totalDelegates}
              t={t}
              isMobile={isMobile}
              isMonthly={!!summary.hasMonthlyData}
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
              governanceScores={governanceScores}
              t={t}
              bc={bc}
              isMobile={isMobile}
              onSelect={onSelectDelegate}
              hasMonthlyData={!!summary.hasMonthlyData}
            />
            <AttentionNeededCard
              delegates={delegates}
              hasTracked={hasTracked}
              trackedLabelPlural={trackedLabelPlural}
              t={t}
              isMobile={isMobile}
              onSelect={onSelectDelegate}
              hasMonthlyData={!!summary.hasMonthlyData}
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
}: {
  summary: DashboardSummary;
  t: ReturnType<typeof c>;
  accent?: string;
  isMobile: boolean;
  avgGovScore: number | null;
}) {
  const hasMonthly = summary.hasMonthlyData;
  const monthlyActive = hasMonthly ? (summary.monthlyActiveContributors ?? 0) : summary.delegatesPostedLast30Days;
  const activeRate = summary.totalDelegates > 0
    ? Math.round((monthlyActive / summary.totalDelegates) * 100)
    : 0;

  const cards = [
    { label: 'Total Contributors', value: summary.totalDelegates, icon: Users },
    { label: 'Active This Month', value: monthlyActive, icon: Activity },
    { label: avgGovScore != null ? 'Avg Gov Score' : (hasMonthly ? 'Posts This Month' : 'Median Posts'),
      value: avgGovScore != null ? avgGovScore : (hasMonthly ? (summary.monthlyPostTotal ?? 0) : (summary.medianPostCount ?? 0)),
      icon: avgGovScore != null ? Target : MessageSquare },
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
  isMonthly,
}: {
  distribution: DashboardSummary['activityDistribution'];
  total: number;
  t: ReturnType<typeof c>;
  isMobile: boolean;
  isMonthly?: boolean;
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
        Activity Distribution{isMonthly ? ' (Last 30 Days)' : ''}
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
  hasMonthlyData,
}: {
  delegates: DelegateRow[];
  governanceScores?: GovernanceScore[];
  t: ReturnType<typeof c>;
  bc: BrandedColorsResult | null;
  isMobile: boolean;
  onSelect: (username: string) => void;
  hasMonthlyData?: boolean;
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
    // Fallback: monthly or all-time posts
    if (hasMonthlyData) {
      return [...delegates]
        .filter((d) => (d.postCountMonth ?? 0) > 0)
        .sort((a, b) => (b.postCountMonth ?? 0) - (a.postCountMonth ?? 0))
        .slice(0, 5);
    }
    return [...delegates].sort((a, b) => b.postCount - a.postCount).slice(0, 5);
  }, [delegates, hasMonthlyData, scoreMap]);

  if (top5.length === 0) {
    if (hasMonthlyData) {
      return (
        <div
          style={{
            padding: isMobile ? '14px 14px' : '18px 20px',
            borderRadius: 12,
            border: `1px solid ${t.border}`,
            background: t.bgCard,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Recently Active</div>
          <div style={{ fontSize: 13, color: t.fgDim }}>No contributors posted in the last 30 days.</div>
        </div>
      );
    }
    return null;
  }

  const useGovScore = scoreMap && scoreMap.size > 0;
  const title = useGovScore ? 'Governance Leaderboard' : (hasMonthlyData ? 'Recently Active' : 'Top Contributors');

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
          const postDisplay = hasMonthlyData ? (d.postCountMonth ?? 0) : d.postCount;
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
                      {hasMonthlyData && <span style={{ fontSize: 10, color: t.fgDim, fontWeight: 400 }}> this month</span>}
                    </div>
                    {!hasMonthlyData && d.postCountPercentile != null && (
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

function AttentionNeededCard({
  delegates,
  hasTracked,
  trackedLabelPlural,
  t,
  isMobile,
  onSelect,
  hasMonthlyData,
}: {
  delegates: DelegateRow[];
  hasTracked: boolean;
  trackedLabelPlural: string;
  t: ReturnType<typeof c>;
  isMobile: boolean;
  onSelect: (username: string) => void;
  hasMonthlyData?: boolean;
}) {
  const dormantDelegates = useMemo(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const candidates = hasTracked
      ? delegates.filter(d => d.isTracked || d.verifiedStatus)
      : delegates;

    let dormant: Array<DelegateRow & { daysSincePost: number }>;

    if (hasMonthlyData) {
      dormant = candidates
        .filter(d => (d.postCountMonth ?? 0) === 0)
        .map(d => ({
          ...d,
          daysSincePost: d.lastPostedAt
            ? Math.floor((Date.now() - new Date(d.lastPostedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 999,
        }));
    } else {
      dormant = candidates
        .filter(d => {
          if (!d.lastPostedAt) return true;
          return Date.now() - new Date(d.lastPostedAt).getTime() > THIRTY_DAYS_MS;
        })
        .map(d => ({
          ...d,
          daysSincePost: d.lastPostedAt
            ? Math.floor((Date.now() - new Date(d.lastPostedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 999,
        }));
    }

    return dormant.sort((a, b) => b.daysSincePost - a.daysSincePost).slice(0, 5);
  }, [delegates, hasTracked, hasMonthlyData]);

  if (dormantDelegates.length === 0) {
    return (
      <div
        style={{
          padding: isMobile ? '14px 14px' : '18px 20px',
          borderRadius: 12,
          border: '1px solid rgba(16,185,129,0.2)',
          background: 'rgba(16,185,129,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} style={{ color: '#10b981' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
            All {hasTracked ? trackedLabelPlural.toLowerCase() : 'contributors'} active
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.fgMuted, marginTop: 6 }}>
          Everyone has posted within the last 30 days.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: isMobile ? '14px 14px' : '18px 20px',
        borderRadius: 12,
        border: `1px solid rgba(245,158,11,0.2)`,
        background: 'rgba(245,158,11,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>Attention Needed</span>
        <span style={{ fontSize: 11, color: t.fgDim }}>
          {dormantDelegates.length} dormant {hasTracked ? trackedLabelPlural.toLowerCase() : 'contributor'}
          {dormantDelegates.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {dormantDelegates.map((d) => (
          <div
            key={d.username}
            onClick={() => onSelect(d.username)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.username); } }}
            tabIndex={0}
            role="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {d.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={d.avatarUrl} alt="" width={24} height={24} style={{ borderRadius: '50%', flexShrink: 0 }} />
            ) : (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: t.bgActive,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {d.displayName?.[0] || '?'}
              </div>
            )}
            <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.fg }}>
              {d.displayName}
            </span>
            <span style={{ fontSize: 11, color: '#f59e0b', flexShrink: 0 }}>
              {d.lastPostedAt
                ? `last seen ${formatDistanceToNow(new Date(d.lastPostedAt), { addSuffix: true })}`
                : 'never posted'}
            </span>
          </div>
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
