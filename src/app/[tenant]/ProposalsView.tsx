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
} from 'lucide-react';
import type { GovernanceProposal, ProposalStatus, ProposalTimeline, TenantBranding } from '@/types/delegates';
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

export default function ProposalsView({ slug, t, bc, isMobile, forumUrl }: ProposalsViewProps) {
  const [timeline, setTimeline] = useState<ProposalTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/delegates/${encodeURIComponent(slug)}/proposals`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ProposalTimeline) => {
        if (!cancelled) {
          setTimeline(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
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

      {/* Status Filter */}
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
        {/* Status indicator */}
        <StatusIcon
          size={16}
          style={{ color: statusCfg.color, flexShrink: 0, marginTop: 2 }}
        />

        {/* Content */}
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

          {/* Meta row */}
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

        {/* Expand toggle */}
        {expanded ? (
          <ChevronUp size={16} style={{ color: t.fgDim, flexShrink: 0, marginTop: 2 }} />
        ) : (
          <ChevronDown size={16} style={{ color: t.fgDim, flexShrink: 0, marginTop: 2 }} />
        )}
      </div>

      {/* Expanded details */}
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
