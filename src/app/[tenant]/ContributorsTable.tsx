'use client';

import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  ThumbsUp,
  Star,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import type { DelegateRow, GovernanceScore, DashboardPeriod } from '@/types/delegates';
import type { c } from '@/lib/theme';
import type { SortField, SortDir, BrandedColorsResult } from './dashboardUtils';
import { getActivityTier, dashboardGetRoleColor, dashboardGetRoleLabel, getPostCountForPeriod, getTopicCountForPeriod, getLikesForPeriod, getDaysVisitedForPeriod } from './dashboardUtils';
import { GovScorePill } from './OverviewTab';
import { formatDistanceToNow } from 'date-fns';

// --- Sort Header ---

export function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
  t,
  accent,
  sticky,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  t: ReturnType<typeof c>;
  accent?: string;
  sticky?: boolean;
}) {
  const isActive = current === field;
  const activeColor = accent || t.fg;
  return (
    <th
      style={{
        padding: 0,
        position: sticky ? 'sticky' : undefined,
        left: sticky ? 0 : undefined,
        background: sticky ? t.bg : undefined,
        zIndex: sticky ? 2 : undefined,
      }}
    >
      <button
        onClick={() => onSort(field)}
        aria-sort={isActive ? (dir === 'desc' ? 'descending' : 'ascending') : undefined}
        style={{
          all: 'unset',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          padding: '10px 16px',
          textAlign: field === 'displayName' ? 'left' : 'right',
          justifyContent: field === 'displayName' ? 'flex-start' : 'flex-end',
          color: isActive ? activeColor : t.fgDim,
          fontWeight: 500,
          fontSize: 12,
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
        }}
      >
        {label}
        {isActive ? (
          dir === 'desc' ? (
            <ArrowDown size={12} />
          ) : (
            <ArrowUp size={12} />
          )
        ) : (
          <ArrowUpDown size={11} color={t.fgDim} style={{ opacity: 0.5 }} />
        )}
      </button>
    </th>
  );
}

// --- Percentile pill (shown inline next to post count) ---

function PercentilePill({ percentile, t }: { percentile: number; t: ReturnType<typeof c> }) {
  const rank = 100 - percentile;
  if (rank > 25) return null; // Only show for top 25%
  const color = rank <= 5 ? '#10b981' : rank <= 10 ? '#22c55e' : '#3b82f6';
  return (
    <span
      style={{
        fontSize: 9,
        padding: '1px 5px',
        borderRadius: 9999,
        background: `${color}15`,
        border: `1px solid ${color}33`,
        color,
        marginLeft: 4,
        whiteSpace: 'nowrap',
        fontWeight: 500,
      }}
    >
      top {rank}%
    </span>
  );
}

// --- Desktop Table Row ---

export function DelegateTableRow({
  delegate: d,
  forumUrl,
  isSelected,
  onSelect,
  t,
  accentHover,
  accentBg,
  showUsername,
  govScore,
  period = 'all',
}: {
  delegate: DelegateRow;
  forumUrl: string;
  isSelected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof c>;
  accentHover?: string;
  accentBg?: string;
  showUsername?: boolean;
  govScore?: GovernanceScore;
  period?: DashboardPeriod;
}) {
  const seenAgo = d.lastSeenAt
    ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true })
    : '\u2014';

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const stale = d.lastSeenAt
    ? Date.now() - new Date(d.lastSeenAt).getTime() > THIRTY_DAYS_MS
    : false;

  return (
    <tr
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      aria-selected={isSelected}
      style={{
        borderBottom: `1px solid ${t.border}`,
        cursor: 'pointer',
        background: isSelected ? (accentBg || t.bgActive) : 'transparent',
        transition: 'background 0.1s',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = accentHover || t.bgSubtle;
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Contributor name cell */}
      <td
        style={{
          padding: '10px 16px',
          whiteSpace: 'nowrap',
          position: 'sticky',
          left: 0,
          background: isSelected ? (accentBg || t.bgActive) : t.bg,
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {d.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={d.avatarUrl}
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: '50%', flexShrink: 0 }}
            />
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
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span>{d.displayName}</span>
              {showUsername && (
                <span style={{ fontSize: 11, color: t.fgDim, fontWeight: 400 }}>@{d.username}</span>
              )}
              {d.isTracked && (
                <Star
                  size={11}
                  fill="currentColor"
                  style={{ color: '#f59e0b', flexShrink: 0 }}
                />
              )}
              {d.verifiedStatus && (
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 9999,
                  background: '#22c55e15', border: '1px solid #22c55e33',
                  color: '#22c55e', whiteSpace: 'nowrap', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  <CheckCircle2 size={9} /> Verified
                </span>
              )}
              {(() => {
                const periodPosts = getPostCountForPeriod(d, period);
                const tier = getActivityTier(periodPosts, period);
                return (
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 6px',
                      borderRadius: 9999,
                      background: `${tier.color}15`,
                      border: `1px solid ${tier.color}33`,
                      color: tier.color,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {tier.label}
                  </span>
                );
              })()}
              {!d.isActive && (
                <span
                  style={{
                    fontSize: 9,
                    color: '#f59e0b',
                    background: 'rgba(245,158,11,0.1)',
                    padding: '1px 6px',
                    borderRadius: 9999,
                    flexShrink: 0,
                  }}
                >
                  Inactive
                </span>
              )}
            </div>
            <a
              href={`${forumUrl}/u/${d.username}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, color: t.fgDim, textDecoration: 'none' }}
            >
              {showUsername ? 'View profile' : `@${d.username}`}
            </a>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        {d.role ? (
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 9999,
              background: `${dashboardGetRoleColor(d.role)}15`,
              border: `1px solid ${dashboardGetRoleColor(d.role)}33`,
              color: dashboardGetRoleColor(d.role),
              whiteSpace: 'nowrap',
            }}
          >
            {dashboardGetRoleLabel(d.role)}
          </span>
        ) : (
          <span style={{ color: t.fgDim, fontSize: 12 }}>{'\u2014'}</span>
        )}
      </td>
      {/* Gov Score column */}
      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
        {govScore ? (
          <GovScorePill score={govScore.combinedScore} />
        ) : (
          <span style={{ color: t.fgDim, fontSize: 12 }}>{'\u2014'}</span>
        )}
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.fg }}>
        {getPostCountForPeriod(d, period).toLocaleString()}
        {period === 'all' && d.postCountPercentile != null && <PercentilePill percentile={d.postCountPercentile} t={t} />}
      </td>
      <NumCell value={getTopicCountForPeriod(d, period)} t={t} />
      <NumCell value={getLikesForPeriod(d, period)} t={t} />
      <NumCell value={getDaysVisitedForPeriod(d, period)} t={t} />
      <NumCell value={d.rationaleCount} t={t} highlight={d.rationaleCount === 0} />
      <td
        style={{
          padding: '10px 16px',
          textAlign: 'right',
          color: d.voteRate != null ? t.fg : t.fgDim,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {d.voteRate != null ? `${d.voteRate}%` : '\u2014'}
      </td>
      <td
        style={{
          padding: '10px 16px',
          textAlign: 'right',
          color: stale ? '#f59e0b' : t.fgMuted,
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        {seenAgo}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {d.programs.map((p) => (
            <span
              key={p}
              style={{
                fontSize: 10,
                padding: '1px 7px',
                borderRadius: 9999,
                background: t.bgBadge,
                border: `1px solid ${t.border}`,
                color: t.fgMuted,
                whiteSpace: 'nowrap',
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

// --- Mobile Card ---

export function MobileDelegateCard({
  delegate: d,
  isSelected,
  onSelect,
  t,
  accentHover,
  accentBg,
  showUsername,
  govScore,
  period = 'all',
}: {
  delegate: DelegateRow;
  isSelected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof c>;
  accentHover?: string;
  accentBg?: string;
  showUsername?: boolean;
  govScore?: GovernanceScore;
  period?: DashboardPeriod;
}) {
  const seenAgo = d.lastSeenAt
    ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true })
    : '\u2014';

  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        border: `1px solid ${isSelected ? t.borderActive : t.border}`,
        background: isSelected ? (accentBg || t.bgActive) : t.bgCard,
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = accentHover || t.bgCardHover;
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = t.bgCard;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {d.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={d.avatarUrl}
            alt=""
            width={32}
            height={32}
            style={{ borderRadius: '50%', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: t.bgActive,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {d.displayName?.[0] || '?'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.displayName}
            </span>
            {showUsername && (
              <span style={{ fontSize: 11, color: t.fgDim }}>@{d.username}</span>
            )}
            {d.isTracked && (
              <Star size={11} fill="currentColor" style={{ color: '#f59e0b', flexShrink: 0 }} />
            )}
            {d.verifiedStatus && (
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 9999,
                background: '#22c55e15', border: '1px solid #22c55e33',
                color: '#22c55e', whiteSpace: 'nowrap', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <CheckCircle2 size={9} /> Verified
              </span>
            )}
            {(() => {
              const periodPosts = getPostCountForPeriod(d, period);
              const tier = getActivityTier(periodPosts, period);
              return (
                <span
                  style={{
                    fontSize: 9,
                    padding: '1px 6px',
                    borderRadius: 9999,
                    background: `${tier.color}15`,
                    border: `1px solid ${tier.color}33`,
                    color: tier.color,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {tier.label}
                </span>
              );
            })()}
            {!d.isActive && (
              <span
                style={{
                  fontSize: 9,
                  color: '#f59e0b',
                  background: 'rgba(245,158,11,0.1)',
                  padding: '1px 6px',
                  borderRadius: 9999,
                  flexShrink: 0,
                }}
              >
                Inactive
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: t.fgDim }}>
            {showUsername ? 'View profile' : `@${d.username}`}
          </div>
        </div>
        {govScore && <GovScorePill score={govScore.combinedScore} />}
        {d.role && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 9999,
              background: `${dashboardGetRoleColor(d.role)}15`,
              border: `1px solid ${dashboardGetRoleColor(d.role)}33`,
              color: dashboardGetRoleColor(d.role),
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {dashboardGetRoleLabel(d.role)}
          </span>
        )}
        <ChevronRight size={14} color={t.fgDim} style={{ flexShrink: 0 }} />
      </div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 8,
          paddingTop: 8,
          borderTop: `1px solid ${t.border}`,
          fontSize: 12,
          color: t.fgMuted,
        }}
      >
        <span><MessageSquare size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />{getPostCountForPeriod(d, period)}
          {period === 'all' && d.postCountPercentile != null && d.postCountPercentile >= 75 && (
            <PercentilePill percentile={d.postCountPercentile} t={t} />
          )}
        </span>
        <span><ThumbsUp size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />{getLikesForPeriod(d, period)}</span>
        <span style={{ color: t.fgDim }}>Seen {seenAgo}</span>
      </div>
    </div>
  );
}

// --- Numeric Cell ---

export function NumCell({
  value,
  t,
  highlight,
}: {
  value: number;
  t: ReturnType<typeof c>;
  highlight?: boolean;
}) {
  return (
    <td
      style={{
        padding: '10px 16px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        color: highlight ? '#f59e0b' : t.fg,
      }}
    >
      {value.toLocaleString()}
    </td>
  );
}
