'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Search,
  RefreshCw,
  ExternalLink,
  Moon,
  Sun,
} from 'lucide-react';
import Link from 'next/link';
import type { DelegateDashboard, TenantSnapshotData, GovernanceScore, DashboardPeriod } from '@/types/delegates';
import { c } from '@/lib/theme';
import ProposalsView from './ProposalsView';
import OverviewTab from './OverviewTab';
import { SortHeader, DelegateTableRow, MobileDelegateCard } from './ContributorsTable';
import DelegateDetailPanel from './DelegateDetailPanel';
import { brandedColors, dashboardGetRoleLabel, getPostCountForPeriod, getTopicCountForPeriod, getLikesForPeriod, getDaysVisitedForPeriod } from './dashboardUtils';
import type { SortField, SortDir, FilterProgram, FilterRole, FilterStatus } from './dashboardUtils';
import { useTenantRoles } from '@/hooks/useTenantRoles';
import { formatDistanceToNow } from 'date-fns';

const RESERVED_SLUGS = new Set([
  'terms', 'about', 'privacy', 'contact', 'pricing',
  'help', 'docs', 'blog', 'login', 'signup', 'settings',
]);

export default function TenantDashboardPage() {
  const params = useParams();
  const slug = params.tenant as string;

  const [dashboard, setDashboard] = useState<DelegateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('discuss-watch-theme') !== 'light';
  });
  const [sortField, setSortField] = useState<SortField>('postCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgram, setFilterProgram] = useState<FilterProgram>('all');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterTracked, setFilterTracked] = useState<'all' | 'tracked'>('all');
  const [selectedDelegate, setSelectedDelegate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'contributors' | 'proposals'>('overview');
  const [period, setPeriod] = useState<DashboardPeriod>('year');
  const [snapshotData, setSnapshotData] = useState<TenantSnapshotData | null>(null);
  const [governanceScores, setGovernanceScores] = useState<GovernanceScore[]>([]);

  const t = c(isDark);
  const { isSuperAdmin } = useTenantRoles();
  const branding = dashboard?.tenant.branding;
  const bc = brandedColors(branding);
  const trackedLabel = dashboard?.tenant.trackedMemberLabel || 'Tracked Member';
  const trackedLabelPlural = dashboard?.tenant.trackedMemberLabelPlural || trackedLabel + 's';
  const hasTracked = (dashboard?.trackedCount ?? 0) > 0;

  // Responsive breakpoint
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem('discuss-watch-theme') as 'dark' | 'light' | null;
    if (saved) {
      document.documentElement.classList.toggle('light', saved === 'light');
      document.documentElement.classList.toggle('dark', saved === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    localStorage.setItem('discuss-watch-theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.dispatchEvent(new Event('themechange'));
  };

  // Fetch dashboard data
  useEffect(() => {
    if (!slug || RESERVED_SLUGS.has(slug)) {
      if (slug && RESERVED_SLUGS.has(slug)) {
        setError('not_found');
        setLoading(false);
      }
      return;
    }
    let cancelled = false;
    const url = filterTracked === 'tracked'
      ? `/api/delegates/${slug}?filter=tracked`
      : `/api/delegates/${slug}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'not_found' : 'fetch_error');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setDashboard(data);
          if (data.governanceScores) {
            setGovernanceScores(data.governanceScores);
          }
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message === 'not_found' ? 'not_found' : 'fetch_error');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, filterTracked]);

  // Fetch Snapshot data
  useEffect(() => {
    if (!slug || RESERVED_SLUGS.has(slug)) return;
    let cancelled = false;
    fetch(`/api/delegates/${slug}/snapshot`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) setSnapshotData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  // Governance scores map for table/detail
  const govScoreMap = useMemo(() => {
    const m = new Map<string, GovernanceScore>();
    for (const s of governanceScores) m.set(s.username, s);
    return m;
  }, [governanceScores]);

  // Detect duplicate display names
  const duplicateNames = useMemo(() => {
    if (!dashboard) return new Set<string>();
    const counts = new Map<string, number>();
    dashboard.delegates.forEach((d) => {
      const name = d.displayName.toLowerCase();
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    const dupes = new Set<string>();
    counts.forEach((count, name) => { if (count > 1) dupes.add(name); });
    return dupes;
  }, [dashboard]);

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

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.displayName.toLowerCase().includes(q) ||
          d.username.toLowerCase().includes(q)
      );
    }

    if (filterProgram !== 'all') {
      list = list.filter((d) => d.programs.includes(filterProgram));
    }

    if (filterRole !== 'all') {
      list = list.filter((d) => d.role === filterRole);
    }

    if (filterStatus === 'active') {
      list = list.filter((d) => d.isActive);
    } else if (filterStatus === 'inactive') {
      list = list.filter((d) => !d.isActive);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'displayName':
          cmp = a.displayName.localeCompare(b.displayName);
          break;
        case 'postCount':
          cmp = getPostCountForPeriod(a, period) - getPostCountForPeriod(b, period);
          break;
        case 'topicCount':
          cmp = getTopicCountForPeriod(a, period) - getTopicCountForPeriod(b, period);
          break;
        case 'likesReceived':
          cmp = getLikesForPeriod(a, period) - getLikesForPeriod(b, period);
          break;
        case 'daysVisited':
          cmp = getDaysVisitedForPeriod(a, period) - getDaysVisitedForPeriod(b, period);
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
        case 'governanceScore': {
          const sa = govScoreMap.get(a.username)?.combinedScore ?? -1;
          const sb = govScoreMap.get(b.username)?.combinedScore ?? -1;
          cmp = sa - sb;
          break;
        }
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [dashboard, searchQuery, filterProgram, filterRole, filterStatus, sortField, sortDir, govScoreMap, period]);

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

  const closeDelegatePanel = useCallback(() => setSelectedDelegate(null), []);

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
    <div style={{ background: (!isDark && branding?.bgColor) || t.bg, color: t.fg, minHeight: '100vh' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${t.border}`,
          padding: isMobile ? '12px 16px' : '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: (!isDark && branding?.bgColor) || t.bg,
          backdropFilter: 'blur(12px)',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, minWidth: 0 }}>
          {branding?.logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={branding.logoUrl}
              alt={`${dashboard.tenant.name} logo`}
              style={{ height: isMobile ? 24 : 28, width: 'auto', flexShrink: 0 }}
            />
          )}
          <h1 style={{ fontSize: isMobile ? 15 : 18, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dashboard.tenant.name}
          </h1>
          {!isMobile && dashboard.lastRefreshAt && (
            <span style={{ fontSize: 12, color: t.fgDim, whiteSpace: 'nowrap' }}>
              Updated {formatDistanceToNow(new Date(dashboard.lastRefreshAt), { addSuffix: true })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexShrink: 0 }}>
          {isSuperAdmin && (
            <Link
              href="/admin"
              style={{ color: t.fgDim, textDecoration: 'none', fontSize: 12 }}
            >
              Admin
            </Link>
          )}
          <a
            href={dashboard.tenant.forumUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: bc?.accent || t.fgMuted,
              fontSize: 12,
              textDecoration: 'none',
              padding: '4px 10px',
              border: `1px solid ${bc?.accentBorder || t.border}`,
              borderRadius: 6,
            }}
          >
            Forum <ExternalLink size={12} />
          </a>
          <button
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
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

      {/* Stale data warning */}
      {dashboard.lastRefreshAt && (() => {
        const hoursSinceRefresh = (Date.now() - new Date(dashboard.lastRefreshAt!).getTime()) / (1000 * 60 * 60);
        if (hoursSinceRefresh <= 8) return null;
        const staleAgo = formatDistanceToNow(new Date(dashboard.lastRefreshAt!), { addSuffix: true });
        return (
          <div
            style={{
              margin: isMobile ? '0 12px' : '0 24px',
              marginTop: 12,
              padding: '10px 16px',
              borderRadius: 8,
              background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.3)'}`,
              color: isDark ? '#fbbf24' : '#b45309',
              fontSize: 13,
            }}
          >
            Data last refreshed {staleAgo}. Stats may be outdated.
          </div>
        );
      })()}

      {/* Hero section */}
      {branding?.heroTitle && (
        <div
          style={{
            padding: isMobile ? '24px 16px 20px' : '40px 24px 32px',
            textAlign: 'center',
            background: bc?.accentBg || 'transparent',
            borderBottom: bc ? `1px solid ${bc.accentBorder}` : undefined,
          }}
        >
          <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: '0 0 8px' }}>
            {branding.heroTitle}
          </h2>
          {branding.heroSubtitle && (
            <p style={{ fontSize: 15, color: t.fgMuted, margin: 0, maxWidth: 600, marginInline: 'auto' }}>
              {branding.heroSubtitle}
            </p>
          )}
        </div>
      )}

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 24px' }}>
        {/* Tab Control */}
        <div
          style={{
            display: 'flex',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            overflow: 'hidden',
            marginBottom: isMobile ? 16 : 24,
            width: 'fit-content',
          }}
        >
          {(['overview', 'proposals', 'contributors'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: isMobile ? '8px 16px' : '8px 20px',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab ? (bc?.accent || t.fg) : 'transparent',
                color: activeTab === tab ? (bc ? '#fff' : t.bg) : t.fgMuted,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {tab === 'overview' ? 'Overview' : tab === 'proposals' ? 'Proposals' : `Contributors (${dashboard.summary.totalDelegates})`}
            </button>
          ))}
        </div>

        {/* Period Selector (Overview + Contributors) */}
        {activeTab !== 'proposals' && (
          <div
            style={{
              display: 'flex',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              overflow: 'hidden',
              marginBottom: isMobile ? 16 : 24,
              width: 'fit-content',
            }}
          >
            {([
              { key: 'week' as DashboardPeriod, label: 'This Week' },
              { key: 'month' as DashboardPeriod, label: 'This Month' },
              { key: 'year' as DashboardPeriod, label: 'This Year' },
              { key: 'all' as DashboardPeriod, label: 'All Time' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                style={{
                  padding: isMobile ? '6px 12px' : '6px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: period === key ? (bc?.accent || t.fg) : 'transparent',
                  color: period === key ? (bc ? '#fff' : t.bg) : t.fgMuted,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'overview' ? (
          <OverviewTab
            dashboard={dashboard}
            t={t}
            bc={bc}
            isMobile={isMobile}
            onSelectDelegate={(username) => { setSelectedDelegate(username); setActiveTab('contributors'); }}
            hasTracked={hasTracked}
            trackedLabelPlural={trackedLabelPlural}
            snapshotData={snapshotData}
            governanceScores={governanceScores}
            period={period}
          />
        ) : activeTab === 'proposals' ? (
          <ProposalsView
            slug={slug}
            t={t}
            bc={bc}
            isMobile={isMobile}
            forumUrl={dashboard.tenant.forumUrl}
          />
        ) : (
          <>
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
              {hasTracked && (
                <div
                  style={{
                    display: 'flex',
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {(['all', 'tracked'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFilterTracked(mode)}
                      style={{
                        padding: '7px 14px',
                        fontSize: 12,
                        fontWeight: 500,
                        border: 'none',
                        cursor: 'pointer',
                        background: filterTracked === mode ? (bc?.accent || t.fg) : 'transparent',
                        color: filterTracked === mode ? (bc ? '#fff' : t.bg) : t.fgMuted,
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      {mode === 'all' ? 'All Contributors' : trackedLabelPlural}
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  position: 'relative',
                  flex: isMobile ? '1 1 100%' : '1 1 220px',
                  maxWidth: isMobile ? undefined : 320,
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
                  placeholder="Search contributors..."
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

              {!isMobile && (
                <span style={{ fontSize: 12, color: t.fgDim, marginLeft: 'auto' }}>
                  {filteredDelegates.length} contributor{filteredDelegates.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Delegate Table / Cards */}
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredDelegates.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: t.fgDim }}>
                    No contributors found.
                  </div>
                ) : (
                  filteredDelegates.map((d) => (
                    <MobileDelegateCard
                      key={d.username}
                      delegate={d}
                      isSelected={selectedDelegate === d.username}
                      onSelect={() =>
                        setSelectedDelegate(
                          selectedDelegate === d.username ? null : d.username
                        )
                      }
                      t={t}
                      accentHover={bc?.accentHover}
                      accentBg={bc?.accentBg}
                      showUsername={duplicateNames.has(d.displayName.toLowerCase())}
                      govScore={govScoreMap.get(d.username)}
                      period={period}
                    />
                  ))
                )}
              </div>
            ) : (
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
                          label="Contributor"
                          field="displayName"
                          current={sortField}
                          dir={sortDir}
                          onSort={handleSort}
                          t={t}
                          accent={bc?.accent}
                          sticky
                        />
                        <th style={{ padding: '10px 16px', textAlign: 'left', color: t.fgDim, fontWeight: 500, fontSize: 12 }}>
                          Role
                        </th>
                        <SortHeader label="Gov Score" field="governanceScore" current={sortField} dir={sortDir} onSort={handleSort} t={t} accent={bc?.accent} />
                        <SortHeader label="Posts" field="postCount" current={sortField} dir={sortDir} onSort={handleSort} t={t} accent={bc?.accent} />
                        <SortHeader label="Topics" field="topicCount" current={sortField} dir={sortDir} onSort={handleSort} t={t} accent={bc?.accent} />
                        <SortHeader label="Likes" field="likesReceived" current={sortField} dir={sortDir} onSort={handleSort} t={t} accent={bc?.accent} />
                        <SortHeader label="Days Active" field="daysVisited" current={sortField} dir={sortDir} onSort={handleSort} t={t} accent={bc?.accent} />
                        <SortHeader label="Rationales" field="rationaleCount" current={sortField} dir={sortDir} onSort={handleSort} t={t} accent={bc?.accent} />
                        <SortHeader label="Vote Rate" field="voteRate" current={sortField} dir={sortDir} onSort={handleSort} t={t} accent={bc?.accent} />
                        <SortHeader label="Last Seen" field="lastSeenAt" current={sortField} dir={sortDir} onSort={handleSort} t={t} accent={bc?.accent} />
                        <th style={{ padding: '10px 16px', textAlign: 'left', color: t.fgDim, fontWeight: 500, fontSize: 12 }}>
                          Programs
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDelegates.length === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
                            style={{
                              padding: 40,
                              textAlign: 'center',
                              color: t.fgDim,
                            }}
                          >
                            No contributors found.
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
                            accentHover={bc?.accentHover}
                            accentBg={bc?.accentBg}
                            showUsername={duplicateNames.has(d.displayName.toLowerCase())}
                            govScore={govScoreMap.get(d.username)}
                            period={period}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

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
          Identity data from admin-provided records. Not affiliated with Discourse.
        </div>

        {/* Footer */}
        <footer
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: `1px solid ${t.border}`,
            fontSize: 12,
            color: t.fgDim,
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            paddingBottom: 24,
          }}
        >
          {branding?.footerText && (
            <span>{branding.footerText}</span>
          )}
          {!branding?.footerText && (
            <span>
              Powered by{' '}
              <Link href="/" style={{ color: bc?.accent || t.fgMuted, textDecoration: 'none', fontWeight: 500 }}>
                discuss.watch
              </Link>
            </span>
          )}
        </footer>
      </div>

      {/* Detail Panel */}
      {detail && (
        <DelegateDetailPanel
          delegate={detail}
          forumUrl={dashboard.tenant.forumUrl}
          tenantSlug={slug}
          onClose={closeDelegatePanel}
          t={t}
          accent={bc?.accent}
          accentBorder={bc?.accentBorder}
          isMobile={isMobile}
          govScore={govScoreMap.get(detail.username)}
        />
      )}
    </div>
  );
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
        No community dashboard found for <strong>&ldquo;{slug}&rdquo;</strong>
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
