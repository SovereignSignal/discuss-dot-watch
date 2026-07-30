'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  RefreshCw,
  ExternalLink,
  Moon,
  Sun,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import type { DelegateDashboard, TenantSnapshotData, GovernanceScore, DashboardPeriod, FeaturedThread, DelegateActivityThread } from '@/types/delegates';
import { c } from '@/lib/theme';
import ProposalsView from './ProposalsView';
import OverviewTab from './OverviewTab';
import ContributorsTab from './ContributorsTab';
import DelegateDetailPanel from './DelegateDetailPanel';
import AdminPanel from './AdminPanel';
import { brandedColors } from './dashboardUtils';
import { useTenantRoles } from '@/hooks/useTenantRoles';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import { RESERVED_SLUGS } from '@/lib/tenantSlug';

export default function TenantDashboardPage() {
  const params = useParams();
  const slug = params.tenant as string;

  const [dashboard, setDashboard] = useState<DelegateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const { isDark, toggleTheme } = useTheme();
  const [filterTracked, setFilterTracked] = useState<'all' | 'verified'>('all');
  const [selectedDelegate, setSelectedDelegate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'contributors' | 'proposals'>('overview');
  const [period, setPeriod] = useState<DashboardPeriod>('year');
  const [snapshotData, setSnapshotData] = useState<TenantSnapshotData | null>(null);
  const [governanceScores, setGovernanceScores] = useState<GovernanceScore[]>([]);
  const [featuredThreads, setFeaturedThreads] = useState<FeaturedThread[]>([]);
  const [delegateActivityThreads, setDelegateActivityThreads] = useState<DelegateActivityThread[]>([]);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [renderedAt] = useState(() => Date.now());

  const t = c(isDark);
  const { isSuperAdmin, canAdminTenant } = useTenantRoles();
  const branding = dashboard?.tenant.branding;
  const bc = brandedColors(branding);
  const hasVerified = useMemo(() => dashboard?.delegates.some(d => d.verifiedStatus) ?? false, [dashboard]);

  // Delegates filtered by tracked/verified toggle (for overview stats), before search/role/status
  const viewDelegates = useMemo(() => {
    if (!dashboard) return [];
    if (filterTracked === 'verified') return dashboard.delegates.filter(d => d.verifiedStatus);
    // 'tracked' is already server-side filtered, 'all' shows everything
    return dashboard.delegates;
  }, [dashboard, filterTracked]);

  // Responsive breakpoint
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

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
    const url = `/api/delegates/${slug}`;
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
  }, [slug]);

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

  // Fetch featured threads
  useEffect(() => {
    if (!slug || RESERVED_SLUGS.has(slug) || !dashboard?.tenant.featuredTopicIds?.length) return;
    let cancelled = false;
    fetch(`/api/delegates/${slug}/featured`)
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setFeaturedThreads(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug, dashboard?.tenant.featuredTopicIds]);

  // Fetch delegate activity threads
  useEffect(() => {
    if (!slug || RESERVED_SLUGS.has(slug) || !hasVerified) return;
    let cancelled = false;
    fetch(`/api/delegates/${slug}/activity-threads`)
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setDelegateActivityThreads(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug, hasVerified]);

  // Governance scores map for table/detail
  const govScoreMap = useMemo(() => {
    const m = new Map<string, GovernanceScore>();
    for (const s of governanceScores) m.set(s.username, s);
    return m;
  }, [governanceScores]);

  const closeDelegatePanel = useCallback(() => setSelectedDelegate(null), []);

  const handleAdminUpdate = useCallback(() => {
    // Re-fetch dashboard data
    const url = `/api/delegates/${slug}`;
    fetch(url)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setDashboard(data);
          if (data.governanceScores) setGovernanceScores(data.governanceScores);
        }
      })
      .catch(() => {});
    // Re-fetch featured threads
    fetch(`/api/delegates/${slug}/featured`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => { if (Array.isArray(data)) setFeaturedThreads(data); })
      .catch(() => {});
  }, [slug]);

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
          {canAdminTenant(slug) && (
            <button
              onClick={() => setAdminPanelOpen(true)}
              aria-label="Admin settings"
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
              <Settings size={14} />
            </button>
          )}
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
        const hoursSinceRefresh = (renderedAt - new Date(dashboard.lastRefreshAt!).getTime()) / (1000 * 60 * 60);
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

        {/* View Filter (Overview tab) */}
        {activeTab === 'overview' && hasVerified && (
          <div
            style={{
              display: 'flex',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              overflow: 'hidden',
              marginBottom: isMobile ? 12 : 16,
              width: 'fit-content',
            }}
          >
            {([
              { key: 'all' as const, label: 'All Contributors' },
              { key: 'verified' as const, label: 'Verified Delegates' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterTracked(key)}
                style={{
                  padding: isMobile ? '6px 12px' : '6px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: filterTracked === key ? (bc?.accent || t.fg) : 'transparent',
                  color: filterTracked === key ? (bc ? '#fff' : t.bg) : t.fgMuted,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

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
            filteredDelegates={viewDelegates}
            t={t}
            bc={bc}
            isMobile={isMobile}
            onSelectDelegate={(username) => { setSelectedDelegate(username); setActiveTab('contributors'); }}
            snapshotData={snapshotData}
            governanceScores={governanceScores}
            period={period}
            filterMode={filterTracked}
            featuredThreads={featuredThreads}
            delegateActivityThreads={delegateActivityThreads}
          />
        ) : activeTab === 'proposals' ? (
          <ProposalsView
            slug={slug}
            t={t}
            bc={bc}
            isMobile={isMobile}
            forumUrl={dashboard.tenant.forumUrl}
            delegates={dashboard.delegates}
          />
        ) : (
          <ContributorsTab
            dashboard={dashboard}
            isMobile={isMobile}
            t={t}
            bc={bc}
            govScoreMap={govScoreMap}
            selectedDelegate={selectedDelegate}
            onSelectDelegate={onSelect => setSelectedDelegate(onSelect)}
            period={period}
            filterTracked={filterTracked}
            onFilterTracked={setFilterTracked}
          />
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

      {/* Admin Panel */}
      {adminPanelOpen && (
        <AdminPanel
          dashboard={dashboard}
          slug={slug}
          isDark={isDark}
          isMobile={isMobile}
          featuredThreads={featuredThreads}
          onClose={() => setAdminPanelOpen(false)}
          onUpdate={handleAdminUpdate}
          t={t}
        />
      )}

      {/* Detail Panel */}
      {detail && (
        <DelegateDetailPanel
          delegate={detail}
          forumUrl={dashboard.tenant.forumUrl}
          tenantSlug={slug}
          agoraProfileBaseUrl={dashboard.tenant.agoraProfileBaseUrl}
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
