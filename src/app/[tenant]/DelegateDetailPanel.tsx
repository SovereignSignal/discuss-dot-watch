'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ExternalLink,
  X,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import type { DelegateRow, GovernanceScore } from '@/types/delegates';
import type { c } from '@/lib/theme';
import { dashboardGetRoleColor, dashboardGetRoleLabel, extractText } from './dashboardUtils';
import { GovScorePill } from './OverviewTab';
import { formatDistanceToNow } from 'date-fns';

export default function DelegateDetailPanel({
  delegate: d,
  forumUrl,
  tenantSlug,
  onClose,
  t,
  accent,
  accentBorder,
  isMobile,
  govScore,
}: {
  delegate: DelegateRow;
  forumUrl: string;
  tenantSlug: string;
  onClose: () => void;
  t: ReturnType<typeof c>;
  accent?: string;
  accentBorder?: string;
  isMobile?: boolean;
  govScore?: GovernanceScore;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [detail, setDetail] = useState<{
    recentPosts: Array<{
      topicTitle: string;
      topicId: number;
      topicSlug: string;
      createdAt: string;
      content: string;
      likeCount: number;
    }>;
    snapshotHistory: Array<{
      capturedAt: string;
      postCount: number;
      rationaleCount: number;
    }>;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  // Accessibility: Escape key, focus trap, scroll lock
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    const panel = panelRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && panel) {
        const focusable = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeBtn = panel?.querySelector<HTMLButtonElement>('[data-close-button]');
    closeBtn?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousActiveElement.current?.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/delegates/${tenantSlug}/${d.username}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !cancelled) {
          setDetail({
            recentPosts: data.recentPosts || [],
            snapshotHistory: data.snapshotHistory || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [tenantSlug, d.username]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${d.displayName} contributor details`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: isMobile ? undefined : 520,
          background: t.bg,
          borderLeft: isMobile ? undefined : `1px solid ${t.border}`,
          zIndex: 50,
          overflowY: 'auto',
          boxShadow: isMobile ? undefined : '-4px 0 24px rgba(0,0,0,0.2)',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            padding: isMobile ? '12px 16px' : '16px 20px',
            borderBottom: `2px solid ${accentBorder || t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: t.bg,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && (
              <button
                data-close-button
                aria-label="Go back"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.fgMuted,
                  padding: 4,
                  marginRight: 2,
                }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {d.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={d.avatarUrl} alt="" width={36} height={36} style={{ borderRadius: '50%' }} />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: t.bgActive,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {d.displayName?.[0] || '?'}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{d.displayName}</div>
              <a
                href={`${forumUrl}/u/${d.username}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: t.fgDim, textDecoration: 'none' }}
              >
                @{d.username} <ExternalLink size={10} style={{ display: 'inline' }} />
              </a>
            </div>
          </div>
          {!isMobile && (
            <button
              data-close-button
              aria-label="Close"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: t.fgMuted,
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ padding: 20 }}>
          {/* Status + Role + Programs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <Badge
              label={d.isActive ? 'Active' : 'Inactive'}
              color={d.isActive ? (accent || '#10b981') : '#f59e0b'}
            />
            {d.role && (
              <Badge label={dashboardGetRoleLabel(d.role)} color={dashboardGetRoleColor(d.role)} />
            )}
            {d.programs.map((p) => (
              <Badge key={p} label={p} color={t.fgDim} />
            ))}
            <Badge label={`Trust Level ${d.trustLevel}`} color={t.fgDim} />
          </div>

          {/* Governance Score */}
          {govScore && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: t.fgDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Governance Score
              </h3>
              <div
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: `1px solid ${accentBorder || t.border}`,
                  background: t.bgSubtle,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <GovScorePill score={govScore.combinedScore} size="md" />
                  <span style={{ fontSize: 12, color: t.fgMuted }}>
                    Combined ({govScore.breakdown.voteRate > 0 ? '60% forum + 40% voting' : 'forum only'})
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: t.fgDim, marginBottom: 2 }}>Forum Score</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{govScore.forumScore}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: t.fgDim, marginBottom: 2 }}>Voting Score</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{govScore.votingScore}</div>
                  </div>
                </div>
                {govScore.breakdown.proposalsTotal > 0 && (
                  <div style={{ fontSize: 11, color: t.fgDim, marginTop: 8, borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
                    Voted on {govScore.breakdown.proposalsVoted} of {govScore.breakdown.proposalsTotal} proposals ({govScore.breakdown.voteRate}%)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <StatBox label="Posts" value={d.postCount} source={d.dataSource.forumStats === 'directory' ? 'Directory' : 'Discourse API'} t={t} accentBorder={accentBorder} percentile={d.postCountPercentile} />
            <StatBox label="Topics Created" value={d.topicCount} source={d.dataSource.forumStats === 'directory' ? 'Directory' : 'Discourse API'} t={t} accentBorder={accentBorder} percentile={d.topicsEnteredPercentile} />
            <StatBox label="Likes Received" value={d.likesReceived} source={d.dataSource.forumStats === 'directory' ? 'Directory' : 'Discourse API'} t={t} accentBorder={accentBorder} percentile={d.likesReceivedPercentile} />
            <StatBox label="Likes Given" value={d.likesGiven} source={d.dataSource.forumStats === 'directory' ? 'Directory' : 'Discourse API'} t={t} accentBorder={accentBorder} />
            <StatBox label="Days Visited" value={d.daysVisited} source={d.dataSource.forumStats === 'directory' ? 'Directory' : 'Discourse API'} t={t} accentBorder={accentBorder} percentile={d.daysVisitedPercentile} />
            <StatBox label="Posts Read" value={d.postsRead} source={d.dataSource.forumStats === 'directory' ? 'Directory' : 'Discourse API'} t={t} accentBorder={accentBorder} />
            <StatBox label="Rationales" value={d.rationaleCount} source="Discourse Search API" t={t} accentBorder={accentBorder} />
            <StatBox
              label="Vote Rate"
              value={d.voteRate != null ? `${d.voteRate}%` : '\u2014'}
              source="Manual entry"
              t={t}
              accentBorder={accentBorder}
            />
          </div>

          {/* Activity Sparkline */}
          {!detailLoading && detail?.snapshotHistory && detail.snapshotHistory.length >= 2 && (
            <ActivitySparkline
              history={detail.snapshotHistory}
              t={t}
              accent={accent}
              accentBorder={accentBorder}
            />
          )}

          {/* Wallet & Identity */}
          {(d.walletAddress || d.kycStatus) && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: t.fgDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Identity
              </h3>
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.bgSubtle,
                  fontSize: 12,
                }}
              >
                {d.walletAddress && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: t.fgDim }}>Wallet: </span>
                    <span style={{ fontFamily: 'var(--font-geist-mono)' }}>
                      {d.walletAddress.slice(0, 6)}...{d.walletAddress.slice(-4)}
                    </span>
                  </div>
                )}
                {d.kycStatus && (
                  <div>
                    <span style={{ color: t.fgDim }}>KYC: </span>
                    <span>{d.kycStatus}</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: t.fgDim, marginTop: 4 }}>
                Source: Admin-provided records
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: t.fgDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Activity Timeline
            </h3>
            <div style={{ fontSize: 12, lineHeight: 2, color: t.fgMuted }}>
              <div>
                <span style={{ color: t.fgDim }}>Last Seen:</span>{' '}
                {d.lastSeenAt ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true }) : '\u2014'}
              </div>
              <div>
                <span style={{ color: t.fgDim }}>Last Posted:</span>{' '}
                {d.lastPostedAt ? formatDistanceToNow(new Date(d.lastPostedAt), { addSuffix: true }) : '\u2014'}
              </div>
              <div>
                <span style={{ color: t.fgDim }}>Snapshot:</span>{' '}
                {d.snapshotAt ? formatDistanceToNow(new Date(d.snapshotAt), { addSuffix: true }) : '\u2014'}
              </div>
            </div>
          </div>

          {/* Recent Posts */}
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: t.fgDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Posts
            </h3>
            {detailLoading ? (
              <div style={{ color: t.fgDim, fontSize: 12 }}>Loading...</div>
            ) : detail?.recentPosts && detail.recentPosts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.recentPosts.slice(0, 10).map((post, i) => (
                  <a
                    key={i}
                    href={`${forumUrl}/t/${post.topicSlug}/${post.topicId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${t.border}`,
                      background: t.bgSubtle,
                      textDecoration: 'none',
                      color: t.fg,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                      {post.topicTitle || 'Untitled'}
                    </div>
                    {post.content && (
                      <div
                        style={{
                          fontSize: 11,
                          color: t.fgDim,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {extractText(post.content, 120)}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 10,
                        color: t.fgDim,
                        marginTop: 4,
                        display: 'flex',
                        gap: 12,
                      }}
                    >
                      <span>{post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : ''}</span>
                      {post.likeCount > 0 && <span>{post.likeCount} likes</span>}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ color: t.fgDim, fontSize: 12 }}>No recent posts available.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// --- Activity Sparkline ---

function ActivitySparkline({
  history,
  t,
  accent,
  accentBorder,
}: {
  history: Array<{ capturedAt: string; postCount: number; rationaleCount: number }>;
  t: ReturnType<typeof c>;
  accent?: string;
  accentBorder?: string;
}) {
  const svgData = useMemo(() => {
    const sorted = [...history].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
    const width = 280;
    const height = 60;
    const padding = 4;

    const postValues = sorted.map(h => h.postCount);
    const rationaleValues = sorted.map(h => h.rationaleCount);
    const maxPost = Math.max(1, ...postValues);
    const maxRationale = Math.max(1, ...rationaleValues);

    function toPath(values: number[], maxVal: number): string {
      const n = values.length;
      if (n < 2) return '';
      const stepX = (width - padding * 2) / (n - 1);
      return values
        .map((v, i) => {
          const x = padding + i * stepX;
          const y = height - padding - ((v / maxVal) * (height - padding * 2));
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    }

    return {
      width,
      height,
      postPath: toPath(postValues, maxPost),
      rationalePath: rationaleValues.some(v => v > 0) ? toPath(rationaleValues, maxRationale) : null,
      points: sorted.length,
    };
  }, [history]);

  if (!svgData.postPath) return null;

  const primaryColor = accent || '#3b82f6';

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: t.fgDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Activity Trend
      </h3>
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          border: `1px solid ${accentBorder || t.border}`,
          background: t.bgSubtle,
        }}
      >
        <svg
          viewBox={`0 0 ${svgData.width} ${svgData.height}`}
          style={{ width: '100%', height: 60 }}
        >
          <path
            d={svgData.postPath}
            fill="none"
            stroke={primaryColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {svgData.rationalePath && (
            <path
              d={svgData.rationalePath}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4,3"
            />
          )}
        </svg>
        <div style={{ display: 'flex', gap: 16, fontSize: 10, color: t.fgDim, marginTop: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 2, background: primaryColor, display: 'inline-block', borderRadius: 1 }} />
            Posts
          </span>
          {svgData.rationalePath && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 2, background: '#8b5cf6', display: 'inline-block', borderRadius: 1, borderTop: '1px dashed #8b5cf6' }} />
              Rationales
            </span>
          )}
          <span style={{ marginLeft: 'auto' }}>{svgData.points} snapshots</span>
        </div>
      </div>
    </div>
  );
}

// --- Badge ---

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 10px',
        borderRadius: 9999,
        border: `1px solid ${color}33`,
        background: `${color}15`,
        color,
      }}
    >
      {label}
    </span>
  );
}

// --- StatBox ---

function StatBox({
  label,
  value,
  source,
  t,
  accentBorder,
  percentile,
}: {
  label: string;
  value: string | number;
  source: string;
  t: ReturnType<typeof c>;
  accentBorder?: string;
  percentile?: number;
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${accentBorder || t.border}`,
        background: t.bgSubtle,
      }}
    >
      <div style={{ fontSize: 11, color: t.fgDim, marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {percentile != null && (
          <span style={{ fontSize: 11, color: t.fgDim, fontWeight: 400 }}>
            top {100 - percentile}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 9, color: t.fgDim, marginTop: 2 }}>{source}</div>
    </div>
  );
}
