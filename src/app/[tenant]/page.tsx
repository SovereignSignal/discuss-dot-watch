'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  Users,
  Activity,
  MessageSquare,
  ThumbsUp,
  Calendar,
  Eye,
  Shield,
  Moon,
  Sun,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import type { DelegateDashboard, DelegateRow, DashboardSummary } from '@/types/delegates';
import { DELEGATE_ROLES } from '@/types/delegates';
import { c } from '@/lib/theme';
import { formatDistanceToNow } from 'date-fns';

type SortField =
  | 'displayName'
  | 'postCount'
  | 'topicCount'
  | 'likesReceived'
  | 'daysVisited'
  | 'rationaleCount'
  | 'voteRate'
  | 'lastSeenAt';
type SortDir = 'asc' | 'desc';
type FilterProgram = 'all' | string;
type FilterRole = 'all' | string;
type FilterStatus = 'all' | 'active' | 'inactive';

export default function TenantDashboardPage() {
  const params = useParams();
  const slug = params.tenant as string;

  const [dashboard, setDashboard] = useState<DelegateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [isDark, setIsDark] = useState(true);
  const [sortField, setSortField] = useState<SortField>('postCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgram, setFilterProgram] = useState<FilterProgram>('all');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedDelegate, setSelectedDelegate] = useState<string | null>(null);

  const t = c(isDark);

  // Theme — apply saved preference to DOM on mount
  useEffect(() => {
    const saved = localStorage.getItem('gov-watch-theme') as 'dark' | 'light' | null;
    if (saved) {
      document.documentElement.classList.toggle('light', saved === 'light');
      document.documentElement.classList.toggle('dark', saved === 'dark');
    }
    // Defer state update to after initial render
    requestAnimationFrame(() => {
      const s = localStorage.getItem('gov-watch-theme') as 'dark' | 'light' | null;
      if (s === 'light') setIsDark(false);
    });
  }, []);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    localStorage.setItem('gov-watch-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  // Fetch dashboard data
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/api/delegates/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'not_found' : 'fetch_error');
        return res.json();
      })
      .then((data: DelegateDashboard) => {
        if (!cancelled) {
          setDashboard(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message === 'not_found' ? 'not_found' : 'fetch_error');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  // Available programs for filter
  const programs = useMemo(() => {
    if (!dashboard) return [];
    const set = new Set<string>();
    dashboard.delegates.forEach((d) => d.programs.forEach((p) => set.add(p)));
    return Array.from(set).sort();
  }, [dashboard]);

  // Available roles for filter
  const roles = useMemo(() => {
    if (!dashboard) return [];
    const set = new Set<string>();
    dashboard.delegates.forEach((d) => { if (d.role) set.add(d.role); });
    return Array.from(set).sort();
  }, [dashboard]);

  // Filter + sort delegates
  const filteredDelegates = useMemo(() => {
    if (!dashboard) return [];
    let list = [...dashboard.delegates];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.displayName.toLowerCase().includes(q) ||
          d.username.toLowerCase().includes(q)
      );
    }

    // Program filter
    if (filterProgram !== 'all') {
      list = list.filter((d) => d.programs.includes(filterProgram));
    }

    // Role filter
    if (filterRole !== 'all') {
      list = list.filter((d) => d.role === filterRole);
    }

    // Status filter
    if (filterStatus === 'active') {
      list = list.filter((d) => d.isActive);
    } else if (filterStatus === 'inactive') {
      list = list.filter((d) => !d.isActive);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'displayName':
          cmp = a.displayName.localeCompare(b.displayName);
          break;
        case 'postCount':
          cmp = a.postCount - b.postCount;
          break;
        case 'topicCount':
          cmp = a.topicCount - b.topicCount;
          break;
        case 'likesReceived':
          cmp = a.likesReceived - b.likesReceived;
          break;
        case 'daysVisited':
          cmp = a.daysVisited - b.daysVisited;
          break;
        case 'rationaleCount':
          cmp = a.rationaleCount - b.rationaleCount;
          break;
        case 'voteRate':
          cmp = (a.voteRate ?? -1) - (b.voteRate ?? -1);
          break;
        case 'lastSeenAt': {
          const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          cmp = at - bt;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [dashboard, searchQuery, filterProgram, filterRole, filterStatus, sortField, sortDir]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField]
  );

  // --- Render ---

  if (loading) {
    return <LoadingSkeleton isDark={isDark} />;
  }

  if (error === 'not_found') {
    return <NotFound slug={slug} isDark={isDark} />;
  }

  if (error || !dashboard) {
    return <ErrorState isDark={isDark} />;
  }

  const detail = selectedDelegate
    ? dashboard.delegates.find((d) => d.username === selectedDelegate)
    : null;

  return (
    <div style={{ background: t.bg, color: t.fg, minHeight: '100vh' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${t.border}`,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: t.bg,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/"
            style={{ color: t.fgDim, textDecoration: 'none', fontSize: 13 }}
          >
            discuss.watch
          </Link>
          <ChevronRight size={14} color={t.fgDim} />
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            {dashboard.tenant.name}
          </h1>
          <span
            style={{
              fontSize: 11,
              color: t.fgDim,
              background: t.bgActive,
              padding: '2px 8px',
              borderRadius: 9999,
            }}
          >
            Delegate Dashboard
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dashboard.lastRefreshAt && (
            <span style={{ fontSize: 12, color: t.fgDim }}>
              Updated {formatDistanceToNow(new Date(dashboard.lastRefreshAt), { addSuffix: true })}
            </span>
          )}
          <a
            href={dashboard.tenant.forumUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: t.fgMuted,
              fontSize: 12,
              textDecoration: 'none',
              padding: '4px 10px',
              border: `1px solid ${t.border}`,
              borderRadius: 6,
            }}
          >
            Forum <ExternalLink size={12} />
          </a>
          <button
            onClick={toggleTheme}
            style={{
              background: 'none',
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              padding: '5px 7px',
              cursor: 'pointer',
              color: t.fgMuted,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px' }}>
        {/* Summary Cards */}
        <SummaryCards summary={dashboard.summary} t={t} />

        {/* Filters Bar */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: '1 1 220px',
              maxWidth: 320,
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: t.fgDim,
              }}
            />
            <input
              type="text"
              placeholder="Search delegates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: t.bgInput,
                color: t.fg,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgInput,
              color: t.fg,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {programs.length > 0 && (
            <select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: t.bgInput,
                color: t.fg,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <option value="all">All Programs</option>
              {programs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

          {roles.length > 0 && (
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: t.bgInput,
                color: t.fg,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {dashboardGetRoleLabel(r)}
                </option>
              ))}
            </select>
          )}

          <span style={{ fontSize: 12, color: t.fgDim, marginLeft: 'auto' }}>
            {filteredDelegates.length} delegate{filteredDelegates.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Delegate Table */}
        <div
          style={{
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  <SortHeader
                    label="Delegate"
                    field="displayName"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    t={t}
                    sticky
                  />
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: t.fgDim, fontWeight: 500, fontSize: 12 }}>
                    Role
                  </th>
                  <SortHeader label="Posts" field="postCount" current={sortField} dir={sortDir} onSort={handleSort} t={t} />
                  <SortHeader label="Topics" field="topicCount" current={sortField} dir={sortDir} onSort={handleSort} t={t} />
                  <SortHeader label="Likes" field="likesReceived" current={sortField} dir={sortDir} onSort={handleSort} t={t} />
                  <SortHeader label="Days Active" field="daysVisited" current={sortField} dir={sortDir} onSort={handleSort} t={t} />
                  <SortHeader label="Rationales" field="rationaleCount" current={sortField} dir={sortDir} onSort={handleSort} t={t} />
                  <SortHeader label="Vote Rate" field="voteRate" current={sortField} dir={sortDir} onSort={handleSort} t={t} />
                  <SortHeader label="Last Seen" field="lastSeenAt" current={sortField} dir={sortDir} onSort={handleSort} t={t} />
                  <th style={{ padding: '10px 16px', textAlign: 'left', color: t.fgDim, fontWeight: 500, fontSize: 12 }}>
                    Programs
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDelegates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        padding: 40,
                        textAlign: 'center',
                        color: t.fgDim,
                      }}
                    >
                      No delegates found.
                    </td>
                  </tr>
                ) : (
                  filteredDelegates.map((d) => (
                    <DelegateTableRow
                      key={d.username}
                      delegate={d}
                      forumUrl={dashboard.tenant.forumUrl}
                      isSelected={selectedDelegate === d.username}
                      onSelect={() =>
                        setSelectedDelegate(
                          selectedDelegate === d.username ? null : d.username
                        )
                      }
                      t={t}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data attribution */}
        <div
          style={{
            marginTop: 24,
            padding: '12px 16px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgSubtle,
            fontSize: 11,
            color: t.fgDim,
            lineHeight: 1.6,
          }}
        >
          <strong>Data sources:</strong> Forum activity stats from the{' '}
          <a
            href="https://docs.discourse.org/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: t.fgMuted, textDecoration: 'underline' }}
          >
            Discourse REST API
          </a>{' '}
          of {dashboard.tenant.forumUrl}. On-chain voting data manually entered (pending chain integration).
          Identity data from admin-provided records. discuss.watch does not generate or infer data.
        </div>

        {/* Footer */}
        <footer
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: `1px solid ${t.border}`,
            fontSize: 11,
            color: t.fgDim,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span>
            Not affiliated with Discourse. Data from the Discourse REST API.{' '}
            <Link href="/terms" style={{ color: t.fgMuted, textDecoration: 'underline' }}>
              Terms
            </Link>
          </span>
          <span>
            <Link href="/" style={{ color: t.fgMuted, textDecoration: 'none' }}>
              discuss.watch
            </Link>{' '}
            — Delegate monitoring for governance forums
          </span>
        </footer>
      </div>

      {/* Detail Panel (slide-in) */}
      {detail && (
        <DelegateDetailPanel
          delegate={detail}
          forumUrl={dashboard.tenant.forumUrl}
          tenantSlug={slug}
          onClose={() => setSelectedDelegate(null)}
          t={t}
          isDark={isDark}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SummaryCards({ summary, t }: { summary: DashboardSummary; t: ReturnType<typeof c> }) {
  const cards = [
    { label: 'Total Delegates', value: summary.totalDelegates, icon: Users },
    { label: 'Active', value: summary.activeDelegates, icon: Activity },
    { label: 'Avg Posts', value: summary.avgPostCount, icon: MessageSquare },
    { label: 'Avg Likes Received', value: summary.avgLikesReceived, icon: ThumbsUp },
    { label: 'Avg Rationales', value: summary.avgRationaleCount, icon: FileText },
    {
      label: 'Seen Last 30d',
      value: `${summary.delegatesSeenLast30Days}/${summary.totalDelegates}`,
      icon: Eye,
    },
    {
      label: 'Posted Last 30d',
      value: `${summary.delegatesPostedLast30Days}/${summary.totalDelegates}`,
      icon: Calendar,
    },
    {
      label: 'Avg Vote Rate',
      value: summary.avgVoteRate != null ? `${summary.avgVoteRate}%` : '—',
      icon: Shield,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
        gap: 10,
        marginBottom: 24,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: t.bgCard,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
            }}
          >
            <card.icon size={13} color={t.fgDim} />
            <span style={{ fontSize: 11, color: t.fgDim }}>{card.label}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
  t,
  sticky,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  t: ReturnType<typeof c>;
  sticky?: boolean;
}) {
  const isActive = current === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: '10px 16px',
        textAlign: field === 'displayName' ? 'left' : 'right',
        color: isActive ? t.fg : t.fgDim,
        fontWeight: 500,
        fontSize: 12,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        position: sticky ? 'sticky' : undefined,
        left: sticky ? 0 : undefined,
        background: sticky ? t.bg : undefined,
        zIndex: sticky ? 2 : undefined,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
      </span>
    </th>
  );
}

function DelegateTableRow({
  delegate: d,
  forumUrl,
  isSelected,
  onSelect,
  t,
}: {
  delegate: DelegateRow;
  forumUrl: string;
  isSelected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof c>;
}) {
  const seenAgo = d.lastSeenAt
    ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true })
    : '—';

  // Inactive warning: not seen in 30+ days (derive from formatted string to avoid impure Date.now)
  const stale = seenAgo.includes('month') || seenAgo.includes('year');

  return (
    <tr
      onClick={onSelect}
      style={{
        borderBottom: `1px solid ${t.border}`,
        cursor: 'pointer',
        background: isSelected ? t.bgActive : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = t.bgSubtle;
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Delegate name cell */}
      <td
        style={{
          padding: '10px 16px',
          whiteSpace: 'nowrap',
          position: 'sticky',
          left: 0,
          background: isSelected ? t.bgActive : t.bg,
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
              {d.displayName[0]}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>
              {d.displayName}
              {!d.isActive && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    color: '#f59e0b',
                    background: 'rgba(245,158,11,0.1)',
                    padding: '1px 6px',
                    borderRadius: 9999,
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
              @{d.username}
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
          <span style={{ color: t.fgDim, fontSize: 12 }}>—</span>
        )}
      </td>
      <NumCell value={d.postCount} t={t} />
      <NumCell value={d.topicCount} t={t} />
      <NumCell value={d.likesReceived} t={t} />
      <NumCell value={d.daysVisited} t={t} />
      <NumCell value={d.rationaleCount} t={t} highlight={d.rationaleCount === 0} />
      <td
        style={{
          padding: '10px 16px',
          textAlign: 'right',
          color: d.voteRate != null ? t.fg : t.fgDim,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {d.voteRate != null ? `${d.voteRate}%` : '—'}
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

function NumCell({
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

// ============================================================
// Detail Panel
// ============================================================

function DelegateDetailPanel({
  delegate: d,
  forumUrl,
  tenantSlug,
  onClose,
  t,
}: {
  delegate: DelegateRow;
  forumUrl: string;
  tenantSlug: string;
  onClose: () => void;
  t: ReturnType<typeof c>;
  isDark: boolean;
}) {
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
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: 520,
          background: t.bg,
          borderLeft: `1px solid ${t.border}`,
          zIndex: 50,
          overflowY: 'auto',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${t.border}`,
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
                {d.displayName[0]}
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
          <button
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
        </div>

        <div style={{ padding: 20 }}>
          {/* Status + Role + Programs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <Badge
              label={d.isActive ? 'Active' : 'Inactive'}
              color={d.isActive ? '#10b981' : '#f59e0b'}
              t={t}
            />
            {d.role && (
              <Badge label={dashboardGetRoleLabel(d.role)} color={dashboardGetRoleColor(d.role)} t={t} />
            )}
            {d.programs.map((p) => (
              <Badge key={p} label={p} color={t.fgDim} t={t} />
            ))}
            <Badge label={`Trust Level ${d.trustLevel}`} color={t.fgDim} t={t} />
          </div>

          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <StatBox label="Posts" value={d.postCount} source="Discourse API" t={t} />
            <StatBox label="Topics Created" value={d.topicCount} source="Discourse API" t={t} />
            <StatBox label="Likes Received" value={d.likesReceived} source="Discourse API" t={t} />
            <StatBox label="Likes Given" value={d.likesGiven} source="Discourse API" t={t} />
            <StatBox label="Days Visited" value={d.daysVisited} source="Discourse API" t={t} />
            <StatBox label="Posts Read" value={d.postsRead} source="Discourse API" t={t} />
            <StatBox label="Rationales" value={d.rationaleCount} source="Discourse Search API" t={t} />
            <StatBox
              label="Vote Rate"
              value={d.voteRate != null ? `${d.voteRate}%` : '—'}
              source="Manual entry"
              t={t}
            />
          </div>

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
                {d.lastSeenAt ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true }) : '—'}
              </div>
              <div>
                <span style={{ color: t.fgDim }}>Last Posted:</span>{' '}
                {d.lastPostedAt ? formatDistanceToNow(new Date(d.lastPostedAt), { addSuffix: true }) : '—'}
              </div>
              <div>
                <span style={{ color: t.fgDim }}>Snapshot:</span>{' '}
                {d.snapshotAt ? formatDistanceToNow(new Date(d.snapshotAt), { addSuffix: true }) : '—'}
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
                        {post.content.replace(/<[^>]+>/g, '').slice(0, 120)}
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

function Badge({ label, color }: { label: string; color: string; t?: ReturnType<typeof c> }) {
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

function StatBox({
  label,
  value,
  source,
  t,
}: {
  label: string;
  value: string | number;
  source: string;
  t: ReturnType<typeof c>;
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.bgSubtle,
      }}
    >
      <div style={{ fontSize: 11, color: t.fgDim, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 9, color: t.fgDim, marginTop: 2 }}>{source}</div>
    </div>
  );
}

// ============================================================
// Role helpers
// ============================================================

function dashboardGetRoleColor(role: string): string {
  switch (role) {
    case 'delegate': return '#6366f1';
    case 'council_member': return '#8b5cf6';
    case 'major_stakeholder': return '#f59e0b';
    case 'contributor': return '#10b981';
    case 'grantee': return '#06b6d4';
    case 'core_team': return '#ec4899';
    case 'advisor': return '#f97316';
    default: return '#71717a';
  }
}

function dashboardGetRoleLabel(role: string): string {
  const found = DELEGATE_ROLES.find(r => r.id === role);
  return found ? found.label : role;
}

// ============================================================
// Loading / Error states
// ============================================================

function LoadingSkeleton({ isDark }: { isDark: boolean }) {
  const t = c(isDark);
  return (
    <div style={{ background: t.bg, color: t.fg, minHeight: '100vh' }}>
      <header
        style={{
          borderBottom: `1px solid ${t.border}`,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 120,
            height: 18,
            background: t.bgActive,
            borderRadius: 4,
          }}
        />
        <div
          style={{
            width: 200,
            height: 24,
            background: t.bgActive,
            borderRadius: 4,
          }}
        />
      </header>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
            gap: 10,
            marginBottom: 24,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 80,
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                background: t.bgCard,
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
        <div
          style={{
            height: 400,
            borderRadius: 12,
            border: `1px solid ${t.border}`,
            background: t.bgCard,
            animation: 'pulse 1.5s infinite',
          }}
        />
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

function NotFound({ slug, isDark }: { slug: string; isDark: boolean }) {
  const t = c(isDark);
  return (
    <div
      style={{
        background: t.bg,
        color: t.fg,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h1 style={{ fontSize: 48, fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ color: t.fgMuted, fontSize: 15, margin: 0 }}>
        No delegate dashboard found for <strong>&ldquo;{slug}&rdquo;</strong>
      </p>
      <Link
        href="/"
        style={{
          marginTop: 12,
          padding: '8px 20px',
          borderRadius: 8,
          background: t.fg,
          color: t.bg,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Go to discuss.watch
      </Link>
    </div>
  );
}

function ErrorState({ isDark }: { isDark: boolean }) {
  const t = c(isDark);
  return (
    <div
      style={{
        background: t.bg,
        color: t.fg,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <RefreshCw size={32} color={t.fgDim} />
      <p style={{ color: t.fgMuted, fontSize: 15, margin: 0 }}>
        Failed to load dashboard. Please try again later.
      </p>
    </div>
  );
}
