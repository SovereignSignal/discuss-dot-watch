'use client';

import { Vote } from 'lucide-react';
import type { DelegateRow, TenantSnapshotData } from '@/types/delegates';
import type { c } from '@/lib/theme';
import type { BrandedColorsResult } from './dashboardUtils';

export function SnapshotSummaryCard({
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
