'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  ArrowLeft,
  Users,
  Activity,
  MessageSquare,
  ThumbsUp,
  Moon,
  Sun,
  FileText,
  Star,
  Sparkles,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import type { DelegateDashboard, DelegateRow, DashboardSummary, TenantBranding } from '@/types/delegates';
import { DELEGATE_ROLES } from '@/types/delegates';
import { c } from '@/lib/theme';
import { useAuth } from '@/components/AuthProvider';
import { isAdminEmail } from '@/lib/admin';
import { formatDistanceToNow } from 'date-fns';

const RESERVED_SLUGS = new Set([
  'terms', 'about', 'privacy', 'contact', 'pricing',
  'help', 'docs', 'blog', 'login', 'signup', 'settings',
]);

/** Derive accent-based color tokens from branding. Returns null if no accent. */
function brandedColors(branding?: TenantBranding) {
  const accent = branding?.accentColor;
  if (!accent) return null;
  // Parse hex to r,g,b for opacity variants
  const hex = accent.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return {
    accent,
    accentBg: `rgba(${r},${g},${b},0.07)`,
    accentBorder: `rgba(${r},${g},${b},0.19)`,
    accentHover: `rgba(${r},${g},${b},0.12)`,
    accentBadgeBg: `rgba(${r},${g},${b},0.12)`,
    accentBadgeBorder: `rgba(${r},${g},${b},0.25)`,
  };
}

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
  const [activeTab, setActiveTab] = useState<'overview' | 'contributors'>('overview');

  const t = c(isDark);
  const { user } = useAuth();
  const userIsAdmin = isAdminEmail(user?.email);
  const branding = dashboard?.tenant.branding;
  const bc = brandedColors(branding);
  const trackedLabel = dashboard?.tenant.trackedMemberLabel || 'Tracked Member';
  const trackedLabelPlural = dashboard?.tenant.trackedMemberLabelPlural || trackedLabel + 's';
  const hasTracked = (dashboard?.trackedCount ?? 0) > 0;

  // Responsive breakpoint
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Theme — apply saved preference to DOM on mount
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
  }, [slug, filterTracked]);

  // Detect duplicate display names for disambiguation
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
          {userIsAdmin && (
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

      {/* Hero section (only when branding has a title) */}
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
          {(['overview', 'contributors'] as const).map((tab) => (
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
              {tab === 'overview' ? 'Overview' : `Contributors (${dashboard.summary.totalDelegates})`}
            </button>
          ))}
        </div>

        {activeTab === 'overview' ? (
          <OverviewTab
            dashboard={dashboard}
            t={t}
            bc={bc}
            isMobile={isMobile}
            onSelectDelegate={(username) => { setSelectedDelegate(username); setActiveTab('contributors'); }}
            hasTracked={hasTracked}
            trackedLabelPlural={trackedLabelPlural}
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
              {/* All / Tracked toggle (only shown if tracked members exist) */}
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
              /* Mobile: Card layout */
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
                    />
                  ))
                )}
              </div>
            ) : (
              /* Desktop: Table layout */
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
                            colSpan={10}
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

      {/* Detail Panel (slide-in) */}
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
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

// ============================================================
// Overview Tab
// ============================================================

function OverviewTab({
  dashboard,
  t,
  bc,
  isMobile,
  onSelectDelegate,
  hasTracked,
  trackedLabelPlural,
}: {
  dashboard: DelegateDashboard;
  t: ReturnType<typeof c>;
  bc: ReturnType<typeof brandedColors>;
  isMobile: boolean;
  onSelectDelegate: (username: string) => void;
  hasTracked: boolean;
  trackedLabelPlural: string;
}) {
  const summary = dashboard.summary;
  const delegates = dashboard.delegates;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
      {/* AI Brief */}
      <AIBriefCard brief={dashboard.brief} t={t} bc={bc} isMobile={isMobile} />

      {/* Key Stats Row */}
      <KeyStatsRow summary={summary} t={t} accent={bc?.accent} isMobile={isMobile} />

      {/* Activity Distribution Bar */}
      <ActivityBar distribution={summary.activityDistribution} total={summary.totalDelegates} t={t} isMobile={isMobile} />

      {/* Top Contributors */}
      <TopContributorsList
        delegates={delegates}
        t={t}
        bc={bc}
        isMobile={isMobile}
        onSelect={onSelectDelegate}
      />

      {/* Highlights */}
      <HighlightsList
        summary={summary}
        delegates={delegates}
        hasTracked={hasTracked}
        trackedLabelPlural={trackedLabelPlural}
        t={t}
        isMobile={isMobile}
      />
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
  bc: ReturnType<typeof brandedColors>;
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
        <span style={{ fontSize: 13, fontWeight: 600 }}>AI Brief</span>
      </div>
      {brief ? (
        <div style={{ fontSize: 14, lineHeight: 1.7, color: t.fgMuted, whiteSpace: 'pre-line' }}>
          {brief}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: t.fgDim, fontStyle: 'italic' }}>
          AI brief is being generated and will appear on next page load.
        </div>
      )}
      <div style={{ fontSize: 10, color: t.fgDim, marginTop: 10 }}>
        Generated by AI — based on community contributor data
      </div>
    </div>
  );
}

function KeyStatsRow({
  summary,
  t,
  accent,
  isMobile,
}: {
  summary: DashboardSummary;
  t: ReturnType<typeof c>;
  accent?: string;
  isMobile: boolean;
}) {
  const healthScore = summary.totalDelegates > 0
    ? Math.round((summary.delegatesSeenLast30Days / summary.totalDelegates) * 100)
    : 0;

  const cards = [
    { label: 'Total Contributors', value: summary.totalDelegates, icon: Users },
    { label: 'Active (30d)', value: summary.delegatesPostedLast30Days, icon: Activity },
    { label: 'Median Posts', value: summary.medianPostCount ?? 0, icon: MessageSquare },
    { label: 'Health Score', value: `${healthScore}%`, icon: TrendingUp },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
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
}: {
  distribution: DashboardSummary['activityDistribution'];
  total: number;
  t: ReturnType<typeof c>;
  isMobile: boolean;
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
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Activity Distribution</div>

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

function TopContributorsList({
  delegates,
  t,
  bc,
  isMobile,
  onSelect,
}: {
  delegates: DelegateRow[];
  t: ReturnType<typeof c>;
  bc: ReturnType<typeof brandedColors>;
  isMobile: boolean;
  onSelect: (username: string) => void;
}) {
  const top5 = useMemo(
    () => [...delegates].sort((a, b) => b.postCount - a.postCount).slice(0, 5),
    [delegates]
  );

  if (top5.length === 0) return null;

  return (
    <div
      style={{
        padding: isMobile ? '14px 14px' : '18px 20px',
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top Contributors</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {top5.map((d, i) => (
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
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.displayName}
              </div>
              <div style={{ fontSize: 11, color: t.fgDim }}>@{d.username}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{d.postCount.toLocaleString()} posts</div>
              {d.postCountPercentile != null && (
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
            </div>
            <ChevronRight size={14} color={t.fgDim} style={{ flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightsList({
  summary,
  delegates,
  hasTracked,
  trackedLabelPlural,
  t,
  isMobile,
}: {
  summary: DashboardSummary;
  delegates: DelegateRow[];
  hasTracked: boolean;
  trackedLabelPlural: string;
  t: ReturnType<typeof c>;
  isMobile: boolean;
}) {
  const highlights: Array<{ icon: typeof AlertTriangle; text: string; color: string }> = [];

  // Tracked members not posting
  if (hasTracked) {
    const tracked = delegates.filter(d => d.isTracked);
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const dormantTracked = tracked.filter(d => {
      if (!d.lastPostedAt) return true;
      return Date.now() - new Date(d.lastPostedAt).getTime() > THIRTY_DAYS;
    });
    if (dormantTracked.length > 0) {
      highlights.push({
        icon: AlertTriangle,
        text: `${dormantTracked.length} ${trackedLabelPlural.toLowerCase()} haven't posted in 30+ days`,
        color: '#f59e0b',
      });
    }
  }

  // Top 10% contributors
  const topTenPercent = delegates.filter(d => d.postCountPercentile != null && d.postCountPercentile >= 90);
  if (topTenPercent.length > 0) {
    highlights.push({
      icon: TrendingUp,
      text: `${topTenPercent.length} contributor${topTenPercent.length !== 1 ? 's' : ''} in the top 10% of forum-wide engagement`,
      color: '#10b981',
    });
  }

  // Rationale authors
  if (hasTracked) {
    const withRationales = delegates.filter(d => d.isTracked && d.rationaleCount > 0);
    if (withRationales.length > 0) {
      highlights.push({
        icon: FileText,
        text: `${withRationales.length} ${trackedLabelPlural.toLowerCase()} have published rationales`,
        color: '#3b82f6',
      });
    }
  }

  // Highly active count
  const highlyActive = summary.activityDistribution?.highlyActive ?? 0;
  if (highlyActive > 0) {
    highlights.push({
      icon: Activity,
      text: `${highlyActive} highly active contributor${highlyActive !== 1 ? 's' : ''} with 50+ posts`,
      color: '#10b981',
    });
  }

  if (highlights.length === 0) return null;

  return (
    <div
      style={{
        padding: isMobile ? '14px 14px' : '18px 20px',
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Highlights</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {highlights.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: t.fgMuted }}>
            <h.icon size={15} color={h.color} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{h.text}</span>
          </div>
        ))}
      </div>
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

function DelegateTableRow({
  delegate: d,
  forumUrl,
  isSelected,
  onSelect,
  t,
  accentHover,
  accentBg,
  showUsername,
}: {
  delegate: DelegateRow;
  forumUrl: string;
  isSelected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof c>;
  accentHover?: string;
  accentBg?: string;
  showUsername?: boolean;
}) {
  const seenAgo = d.lastSeenAt
    ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true })
    : '—';

  // Inactive warning: not seen in 30+ days
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
              {(() => {
                const tier = getActivityTier(d.postCount);
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

function MobileDelegateCard({
  delegate: d,
  isSelected,
  onSelect,
  t,
  accentHover,
  accentBg,
  showUsername,
}: {
  delegate: DelegateRow;
  isSelected: boolean;
  onSelect: () => void;
  t: ReturnType<typeof c>;
  accentHover?: string;
  accentBg?: string;
  showUsername?: boolean;
}) {
  const seenAgo = d.lastSeenAt
    ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true })
    : '—';

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
        border: `1px solid ${isSelected ? (accentBg ? t.borderActive : t.borderActive) : t.border}`,
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
            {(() => {
              const tier = getActivityTier(d.postCount);
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
        <span><MessageSquare size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />{d.postCount}</span>
        <span><ThumbsUp size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />{d.likesReceived}</span>
        <span style={{ color: t.fgDim }}>Seen {seenAgo}</span>
      </div>
    </div>
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
  accent,
  accentBorder,
  isMobile,
}: {
  delegate: DelegateRow;
  forumUrl: string;
  tenantSlug: string;
  onClose: () => void;
  t: ReturnType<typeof c>;
  accent?: string;
  accentBorder?: string;
  isMobile?: boolean;
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

  // Accessibility: Escape key, focus trap, scroll lock, focus management
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    const panel = panelRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      // Focus trap: cycle Tab within the panel
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

    // Focus close button on open
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
              value={d.voteRate != null ? `${d.voteRate}%` : '—'}
              source="Manual entry"
              t={t}
              accentBorder={accentBorder}
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

// ============================================================
// Utilities
// ============================================================

/** Extract plain text from HTML using the browser's native parser */
function extractText(html: string, maxLen: number = 120): string {
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.trim().slice(0, maxLen);
  }
  return html.replace(/<[^>]+>/g, '').trim().slice(0, maxLen);
}

// ============================================================
// Role helpers
// ============================================================

/** Compute activity tier from post count */
function getActivityTier(postCount: number): { label: string; color: string } {
  if (postCount >= 50) return { label: 'Highly Active', color: '#10b981' };
  if (postCount >= 11) return { label: 'Active', color: '#3b82f6' };
  if (postCount >= 2) return { label: 'Low Activity', color: '#f59e0b' };
  if (postCount >= 1) return { label: 'Minimal', color: '#f97316' };
  return { label: 'Dormant', color: '#ef4444' };
}

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
