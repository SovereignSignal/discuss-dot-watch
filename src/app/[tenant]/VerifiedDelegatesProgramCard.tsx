'use client';

import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { DelegateRow, GovernanceScore, DashboardPeriod } from '@/types/delegates';
import type { c } from '@/lib/theme';
import type { BrandedColorsResult } from './dashboardUtils';
import { getPostCountForPeriod, getGcrTier } from './dashboardUtils';

export function VerifiedDelegatesProgramCard({
  delegates,
  governanceScores,
  period,
  t,
  bc,
  isMobile,
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
          value={avgScore != null ? String(avgScore) : '—'}
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
          value={avgForumScore != null ? String(avgForumScore) : '—'}
          sub="avg forum score"
          color={avgForumScore != null && avgForumScore >= 50 ? '#10b981' : '#f59e0b'}
          t={t}
        />
      </div>

      {governanceScores.length > 0 && (
        <div>
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
