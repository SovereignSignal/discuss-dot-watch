'use client';

import { useMemo } from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';
import type { DelegateRow, GovernanceScore, DashboardPeriod } from '@/types/delegates';
import type { c } from '@/lib/theme';
import type { BrandedColorsResult } from './dashboardUtils';
import { GovScorePill } from './GovScorePill';

export function GovernanceLeaderboard({
  delegates,
  governanceScores,
  t,
  bc,
  isMobile,
  onSelect,
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
    if (scoreMap && scoreMap.size > 0) {
      return [...delegates]
        .sort((a, b) => {
          const sa = scoreMap.get(a.username)?.combinedScore ?? 0;
          const sb = scoreMap.get(b.username)?.combinedScore ?? 0;
          return sb - sa;
        })
        .slice(0, 5);
    }
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
          const posts = d.postCountMonth ?? 0;
          const topics = d.topicCountMonth ?? 0;
          const replies = Math.max(0, posts - topics);
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
                  <div style={{ fontSize: 12, color: t.fgDim, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    {topics > 0 && <span><strong style={{ color: t.fg }}>{topics}</strong> topic{topics !== 1 ? 's' : ''}</span>}
                    {replies > 0 && <span><strong style={{ color: t.fg }}>{replies}</strong> repl{replies !== 1 ? 'ies' : 'y'}</span>}
                    {posts === 0 && <span style={{ color: t.fgDim }}>0 posts</span>}
                  </div>
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
