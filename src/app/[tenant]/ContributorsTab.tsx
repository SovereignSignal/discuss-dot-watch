'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { DelegateDashboard, GovernanceScore, DashboardPeriod } from '@/types/delegates';
import type { c } from '@/lib/theme';
import { SortHeader, DelegateTableRow, MobileDelegateCard } from './ContributorsTable';
import { brandedColors, dashboardGetRoleLabel, getPostCountForPeriod, getTopicCountForPeriod, getLikesForPeriod, getDaysVisitedForPeriod, getGcrTier } from './dashboardUtils';
import type { SortField, SortDir, FilterProgram, FilterRole, FilterStatus } from './dashboardUtils';

type ThemeColors = ReturnType<typeof c>;
type BrandColors = ReturnType<typeof brandedColors>;

interface ContributorsTabProps {
  dashboard: DelegateDashboard;
  isMobile: boolean;
  t: ThemeColors;
  bc: BrandColors;
  govScoreMap: Map<string, GovernanceScore>;
  selectedDelegate: string | null;
  onSelectDelegate: (username: string | null) => void;
  period: DashboardPeriod;
  filterTracked: 'all' | 'verified';
  onFilterTracked: (mode: 'all' | 'verified') => void;
}

export default function ContributorsTab({ dashboard, isMobile, t, bc, govScoreMap, selectedDelegate, onSelectDelegate, period, filterTracked, onFilterTracked }: ContributorsTabProps) {
  const [sortField, setSortField] = useState<SortField>('postCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProgram, setFilterProgram] = useState<FilterProgram>('all');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterTier, setFilterTier] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [filterWallet, setFilterWallet] = useState<'all' | 'linked' | 'unlinked'>('all');

  const hasVerified = useMemo(() => dashboard.delegates.some(d => d.verifiedStatus), [dashboard.delegates]);
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    dashboard.delegates.forEach((d) => {
      const name = d.displayName.toLowerCase();
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    const dupes = new Set<string>();
    counts.forEach((count, name) => { if (count > 1) dupes.add(name); });
    return dupes;
  }, [dashboard.delegates]);

  const programs = useMemo(() => {
    const set = new Set<string>();
    dashboard.delegates.forEach((d) => d.programs.forEach((p) => set.add(p)));
    return Array.from(set).sort();
  }, [dashboard.delegates]);

  const roles = useMemo(() => {
    const set = new Set<string>();
    dashboard.delegates.forEach((d) => { if (d.role) set.add(d.role); });
    return Array.from(set).sort();
  }, [dashboard.delegates]);

  const filteredDelegates = useMemo(() => {
    let list = [...dashboard.delegates];
    if (filterTracked === 'verified') list = list.filter(d => d.verifiedStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => d.displayName.toLowerCase().includes(q) || d.username.toLowerCase().includes(q));
    }
    if (filterProgram !== 'all') list = list.filter((d) => d.programs.includes(filterProgram));
    if (filterRole !== 'all') list = list.filter((d) => d.role === filterRole);
    if (filterStatus === 'active') list = list.filter((d) => d.isActive);
    else if (filterStatus === 'inactive') list = list.filter((d) => !d.isActive);
    if (filterWallet === 'linked') list = list.filter((d) => !!d.walletAddress);
    else if (filterWallet === 'unlinked') list = list.filter((d) => !d.walletAddress);
    if (filterTier !== 'all') {
      list = list.filter((d) => {
        const score = govScoreMap.get(d.username)?.combinedScore;
        return score != null && getGcrTier(score).tier === filterTier;
      });
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'displayName': cmp = a.displayName.localeCompare(b.displayName); break;
        case 'postCount': cmp = getPostCountForPeriod(a, period) - getPostCountForPeriod(b, period); break;
        case 'topicCount': cmp = getTopicCountForPeriod(a, period) - getTopicCountForPeriod(b, period); break;
        case 'likesReceived': cmp = getLikesForPeriod(a, period) - getLikesForPeriod(b, period); break;
        case 'daysVisited': cmp = getDaysVisitedForPeriod(a, period) - getDaysVisitedForPeriod(b, period); break;
        case 'rationaleCount': cmp = a.rationaleCount - b.rationaleCount; break;
        case 'voteRate': cmp = (a.voteRate ?? -1) - (b.voteRate ?? -1); break;
        case 'lastSeenAt': cmp = (a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0) - (b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0); break;
        case 'governanceScore': cmp = (govScoreMap.get(a.username)?.combinedScore ?? -1) - (govScoreMap.get(b.username)?.combinedScore ?? -1); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [dashboard.delegates, searchQuery, filterProgram, filterRole, filterStatus, filterTracked, filterTier, filterWallet, sortField, sortDir, govScoreMap, period]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  }, [sortField]);

  return (
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
        {hasVerified && (
          <div
            style={{
              display: 'flex',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {([
              { key: 'all' as const, label: 'All Contributors' },
              { key: 'verified' as const, label: 'Verified Delegates' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onFilterTracked(key)}
                style={{
                  padding: '7px 14px',
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
            aria-label="Search contributors"
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
          aria-label="Filter by status"
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
            aria-label="Filter by program"
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
            aria-label="Filter by role"
          >
            <option value="all">All Roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {dashboardGetRoleLabel(r)}
              </option>
            ))}
          </select>
        )}

        {govScoreMap.size > 0 && (
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5))}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgInput,
              color: t.fg,
              fontSize: 13,
              cursor: 'pointer',
            }}
            aria-label="Filter by governance tier"
          >
            <option value="all">All Tiers</option>
            <option value="1">Tier 1 (90+)</option>
            <option value="2">Tier 2 (80-89)</option>
            <option value="3">Tier 3 (70-79)</option>
            <option value="4">Tier 4 (60-69)</option>
            <option value="5">Tier 5 (&lt;60)</option>
          </select>
        )}

        <select
          value={filterWallet}
          onChange={(e) => setFilterWallet(e.target.value as 'all' | 'linked' | 'unlinked')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgInput,
            color: t.fg,
            fontSize: 13,
            cursor: 'pointer',
          }}
          aria-label="Filter by wallet mapping"
        >
          <option value="all">Any Wallet</option>
          <option value="linked">Wallet linked</option>
          <option value="unlinked">No wallet</option>
        </select>

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
                  onSelectDelegate(
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
                        onSelectDelegate(
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
  );
}

