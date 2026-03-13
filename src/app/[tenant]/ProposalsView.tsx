'use client';

import { useState, useEffect } from 'react';
import {
  ExternalLink,
  Clock,
  MessageSquare,
  Eye,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Vote,
  CheckCircle2,
  XCircle,
  Circle,
  Users,
} from 'lucide-react';
import type { GovernanceProposal, ProposalStatus, ProposalTimeline, TenantBranding, SnapshotProposalSummary, DelegateRow } from '@/types/delegates';
import { formatDistanceToNow } from 'date-fns';

interface ThemeColors {
  fg: string;
  fgSecondary: string;
  fgMuted: string;
  fgDim: string;
  bg: string;
  bgCard: string;
  bgCardHover: string;
  bgInput: string;
  bgActive: string;
  bgSubtle: string;
  bgBadge: string;
  border: string;
  borderSubtle: string;
}

interface BrandedColors {
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentHover: string;
  accentBadgeBg: string;
  accentBadgeBorder: string;
}

interface ProposalsViewProps {
  slug: string;
  t: ThemeColors;
  bc: BrandedColors | null;
  isMobile: boolean;
  forumUrl: string;
}

const STATUS_CONFIG: Record<ProposalStatus, { label: string; color: string; icon: typeof Circle }> = {
  open: { label: 'Open', color: '#22c55e', icon: Circle },
  voting: { label: 'Voting', color: '#eab308', icon: Vote },
  closed: { label: 'Closed', color: '#ef4444', icon: XCircle },
  implemented: { label: 'Implemented', color: '#3b82f6', icon: CheckCircle2 },
};

type StatusFilter = 'all' | ProposalStatus;

interface SnapshotDataWithVotes {
  proposals: SnapshotProposalSummary[];
  delegateVotes?: Record<string, string[]>;
}

export default function ProposalsView({ slug, t, bc, isMobile, forumUrl }: ProposalsViewProps) {
  const [timeline, setTimeline] = useState<ProposalTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [snapshotWithVotes, setSnapshotWithVotes] = useState<SnapshotDataWithVotes | null>(null);
  const [delegates, setDelegates] = useState<DelegateRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Fetch forum proposals and snapshot votes in parallel
    Promise.allSettled([
      fetch(`/api/delegates/${encodeURIComponent(slug)}/proposals`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
      fetch(`/api/delegates/${encodeURIComponent(slug)}/snapshot?include=votes`)
        .then((res) => res.ok ? res.json() : null),
      fetch(`/api/delegates/${encodeURIComponent(slug)}`)
        .then((res) => res.ok ? res.json() : null),
    ]).then(([proposalsResult, snapshotResult, dashboardResult]) => {
      if (cancelled) return;

      if (proposalsResult.status === 'fulfilled') {
        setTimeline(proposalsResult.value);
      } else {
        setError(proposalsResult.reason?.message || 'Failed to load');
      }

      if (snapshotResult.status === 'fulfilled' && snapshotResult.value) {
        setSnapshotWithVotes(snapshotResult.value);
      }

      if (dashboardResult.status === 'fulfilled' && dashboardResult.value?.delegates) {
        setDelegates(dashboardResult.value.delegates);
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: t.fgMuted }}>
        Loading proposals...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: t.fgMuted }}>
        Failed to load proposals: {error}
      </div>
    );
  }

  if (!timeline || timeline.proposals.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: t.fgMuted }}>
        No governance proposals found. Configure proposal categories in the tenant settings.
      </div>
    );
  }

  const filtered = statusFilter === 'all'
    ? timeline.proposals
    : timeline.proposals.filter((p) => p.status === statusFilter);

  const accent = bc?.accent || '#3b82f6';

  // Build wallet -> delegate mapping for vote participation display
  const walletToDelegate = new Map<string, DelegateRow>();
  for (const d of delegates) {
    if (d.walletAddress && d.isTracked) {
      walletToDelegate.set(d.walletAddress.toLowerCase(), d);
    }
  }

  return (
    <div>
      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: isMobile ? 8 : 12,
          marginBottom: isMobile ? 16 : 24,
        }}
      >
        <SummaryCard label="Total" value={timeline.summary.total} color={t.fgSecondary} t={t} />
        <SummaryCard label="Open" value={timeline.summary.open} color="#22c55e" t={t} />
        <SummaryCard label="Voting" value={timeline.summary.voting} color="#eab308" t={t} />
        <SummaryCard label="Recent Activity" value={timeline.summary.recentActivityCount} color={accent} t={t} />
      </div>

      {/* Snapshot Voting Section (if data available) */}
      {snapshotWithVotes && snapshotWithVotes.proposals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Vote size={16} style={{ color: accent }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Snapshot Proposals</span>
            {walletToDelegate.size > 0 && (
              <span style={{ fontSize: 11, color: t.fgDim }}>
                ({walletToDelegate.size} tracked delegate{walletToDelegate.size !== 1 ? 's' : ''} with wallets)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snapshotWithVotes.proposals.slice(0, 10).map((sp) => {
              const voterAddresses = snapshotWithVotes.delegateVotes?.[sp.id] || [];
              const votedDelegates = voterAddresses
                .map(addr => walletToDelegate.get(addr))
                .filter((d): d is DelegateRow => !!d);
              const nonVotedDelegates = Array.from(walletToDelegate.values())
                .filter(d => !voterAddresses.includes(d.walletAddress!.toLowerCase()));

              return (
                <SnapshotProposalCard
                  key={sp.id}
                  proposal={sp}
                  votedDelegates={votedDelegates}
                  nonVotedDelegates={nonVotedDelegates}
                  hasWalletData={walletToDelegate.size > 0}
                  t={t}
                  accent={accent}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Forum Proposals</span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {(['all', 'open', 'voting', 'closed', 'implemented'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              border: `1px solid ${statusFilter === status ? accent : t.border}`,
              background: statusFilter === status ? `${accent}22` : 'transparent',
              color: statusFilter === status ? accent : t.fgMuted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {status === 'all' ? `All (${timeline.summary.total})` :
              `${STATUS_CONFIG[status].label} (${timeline.summary[status]})`}
          </button>
        ))}
      </div>

      {/* Proposals List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            t={t}
            bc={bc}
            isMobile={isMobile}
            forumUrl={forumUrl}
            expanded={expandedId === proposal.id}
            onToggle={() => setExpandedId(expandedId === proposal.id ? null : proposal.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: t.fgMuted, fontSize: 13 }}>
          No {statusFilter} proposals found.
        </div>
      )}
    </div>
  );
}

function SnapshotProposalCard({
  proposal: sp,
  votedDelegates,
  nonVotedDelegates,
  hasWalletData,
  t,
  accent,
}: {
  proposal: SnapshotProposalSummary;
  votedDelegates: DelegateRow[];
  nonVotedDelegates: DelegateRow[];
  hasWalletData: boolean;
  t: ThemeColors;
  accent: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = sp.state === 'active';
  const stateColor = isActive ? '#22c55e' : sp.state === 'pending' ? '#f59e0b' : t.fgDim;

  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        background: t.bgCard,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => hasWalletData && setExpanded(!expanded)}
        style={{
          padding: '10px 14px',
          cursor: hasWalletData ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (hasWalletData) e.currentTarget.style.background = t.bgCardHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = t.bgCard; }}
      >
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: stateColor,
          flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sp.title}
          </div>
          <div style={{ fontSize: 11, color: t.fgDim, marginTop: 2 }}>
            {sp.votes} votes &middot; {sp.state}
          </div>
        </div>
        {hasWalletData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Users size={12} style={{ color: t.fgDim }} />
            <span style={{ fontSize: 11, color: votedDelegates.length > 0 ? '#10b981' : '#f59e0b' }}>
              {votedDelegates.length}/{votedDelegates.length + nonVotedDelegates.length}
            </span>
          </div>
        )}
        <a
          href={sp.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: accent, flexShrink: 0 }}
        >
          <ExternalLink size={12} />
        </a>
        {hasWalletData && (
          expanded ? <ChevronUp size={14} style={{ color: t.fgDim, flexShrink: 0 }} />
            : <ChevronDown size={14} style={{ color: t.fgDim, flexShrink: 0 }} />
        )}
      </div>

      {expanded && hasWalletData && (
        <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${t.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.fgDim, margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Delegate Participation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {votedDelegates.map(d => (
              <div key={d.username} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <CheckCircle2 size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                <span style={{ color: t.fg }}>{d.displayName}</span>
                <span style={{ color: t.fgDim, fontSize: 10 }}>voted</span>
              </div>
            ))}
            {nonVotedDelegates.map(d => (
              <div key={d.username} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <XCircle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ color: t.fgMuted }}>{d.displayName}</span>
                <span style={{ color: t.fgDim, fontSize: 10 }}>did not vote</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  t,
}: {
  label: string;
  value: number;
  color: string;
  t: ThemeColors;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: t.fgMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ProposalCard({
  proposal,
  t,
  bc,
  isMobile,
  forumUrl,
  expanded,
  onToggle,
}: {
  proposal: GovernanceProposal;
  t: ThemeColors;
  bc: BrandedColors | null;
  isMobile: boolean;
  forumUrl: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusCfg = STATUS_CONFIG[proposal.status];
  const StatusIcon = statusCfg.icon;
  const topicUrl = `${forumUrl}/t/${proposal.slug}/${proposal.topicId}`;
  const timeAgo = formatDistanceToNow(new Date(proposal.lastActivityAt), { addSuffix: true });

  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        background: t.bgCard,
        overflow: 'hidden',
      }}
    >
      {/* Main row */}
      <div
        onClick={onToggle}
        style={{
          padding: isMobile ? '12px' : '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.bgCardHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = t.bgCard; }}
      >
        <StatusIcon
          size={16}
          style={{ color: statusCfg.color, flexShrink: 0, marginTop: 2 }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: statusCfg.color,
                padding: '1px 6px',
                borderRadius: 4,
                background: `${statusCfg.color}18`,
                border: `1px solid ${statusCfg.color}33`,
              }}
            >
              {statusCfg.label}
            </span>
            {proposal.categoryName && (
              <span style={{ fontSize: 11, color: t.fgDim }}>
                {proposal.categoryName}
              </span>
            )}
          </div>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: t.fg,
              marginTop: 4,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: expanded ? 'normal' : 'nowrap',
            }}
          >
            {proposal.title}
          </h3>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 8 : 12,
              marginTop: 6,
              fontSize: 12,
              color: t.fgDim,
              flexWrap: 'wrap',
            }}
          >
            <span>{proposal.author}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} /> {timeAgo}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <MessageSquare size={11} /> {proposal.replyCount}
            </span>
            {!isMobile && (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Eye size={11} /> {proposal.views}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ThumbsUp size={11} /> {proposal.likeCount}
                </span>
              </>
            )}
          </div>
        </div>

        {expanded ? (
          <ChevronUp size={16} style={{ color: t.fgDim, flexShrink: 0, marginTop: 2 }} />
        ) : (
          <ChevronDown size={16} style={{ color: t.fgDim, flexShrink: 0, marginTop: 2 }} />
        )}
      </div>

      {expanded && (
        <div
          style={{
            padding: isMobile ? '0 12px 12px' : '0 16px 16px',
            borderTop: `1px solid ${t.borderSubtle}`,
          }}
        >
          {proposal.excerpt && (
            <p style={{ fontSize: 13, color: t.fgMuted, lineHeight: 1.6, marginTop: 12 }}>
              {proposal.excerpt}
            </p>
          )}

          {proposal.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
              {proposal.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: t.bgBadge,
                    color: t.fgMuted,
                    border: `1px solid ${t.borderSubtle}`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <a
            href={topicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 12,
              fontSize: 12,
              color: bc?.accent || '#3b82f6',
              textDecoration: 'none',
            }}
          >
            View on forum <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
