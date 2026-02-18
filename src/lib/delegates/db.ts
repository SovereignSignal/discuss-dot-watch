/**
 * Database operations for delegate monitoring.
 * Uses the existing postgres connection from lib/db.ts.
 */

import { getDb, isDatabaseConfigured } from '@/lib/db';
import type {
  DelegateTenant,
  TenantConfig,
  TenantCapabilities,
  Delegate,
  DelegateSnapshot,
  DiscourseUserStats,
  DiscourseUserPost,
  DelegateRow,
  DelegateDashboard,
  DashboardSummary,
} from '@/types/delegates';

// --- Schema initialization ---

export async function initializeDelegateSchema() {
  if (!isDatabaseConfigured()) return;
  const db = getDb();

  await db`
    CREATE TABLE IF NOT EXISTS delegate_tenants (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      forum_url TEXT NOT NULL,
      api_username TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      config JSONB DEFAULT '{}'::jsonb,
      capabilities JSONB DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      last_refresh_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS delegates (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES delegate_tenants(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      wallet_address TEXT,
      kyc_status TEXT CHECK (kyc_status IN ('verified', 'pending', 'not_required')),
      verified_status BOOLEAN DEFAULT false,
      programs TEXT[] DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      votes_cast INTEGER,
      votes_total INTEGER,
      voting_power TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, username)
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS delegate_snapshots (
      id SERIAL PRIMARY KEY,
      delegate_id INTEGER NOT NULL REFERENCES delegates(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES delegate_tenants(id) ON DELETE CASCADE,
      stats JSONB NOT NULL,
      rationale_count INTEGER DEFAULT 0,
      recent_posts JSONB DEFAULT '[]'::jsonb,
      captured_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Forward-compatible migrations
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS role TEXT DEFAULT NULL`;

  // Indexes
  await db`CREATE INDEX IF NOT EXISTS idx_delegate_tenants_slug ON delegate_tenants(slug)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delegates_tenant_id ON delegates(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delegates_username ON delegates(tenant_id, username)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delegate_snapshots_delegate ON delegate_snapshots(delegate_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delegate_snapshots_tenant ON delegate_snapshots(tenant_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delegate_snapshots_captured ON delegate_snapshots(captured_at DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_delegate_snapshots_delegate_captured ON delegate_snapshots(delegate_id, captured_at DESC)`;

  console.log('[Delegates DB] Schema initialized');
}

// --- Tenant CRUD ---

export async function createTenant(tenant: {
  slug: string;
  name: string;
  forumUrl: string;
  apiUsername: string;
  encryptedApiKey: string;
  config?: TenantConfig;
}): Promise<DelegateTenant> {
  const db = getDb();
  const [row] = await db`
    INSERT INTO delegate_tenants (slug, name, forum_url, api_username, encrypted_api_key, config)
    VALUES (
      ${tenant.slug},
      ${tenant.name},
      ${tenant.forumUrl},
      ${tenant.apiUsername},
      ${tenant.encryptedApiKey},
      ${JSON.stringify(tenant.config || {})}
    )
    RETURNING *
  `;
  return mapTenantRow(row);
}

export async function getTenantBySlug(slug: string): Promise<DelegateTenant | null> {
  const db = getDb();
  const [row] = await db`
    SELECT * FROM delegate_tenants WHERE slug = ${slug} AND is_active = true
  `;
  return row ? mapTenantRow(row) : null;
}

export async function getAllTenants(): Promise<DelegateTenant[]> {
  const db = getDb();
  const rows = await db`SELECT * FROM delegate_tenants ORDER BY name`;
  return rows.map(mapTenantRow);
}

export async function updateTenantCapabilities(
  tenantId: number,
  capabilities: TenantCapabilities
): Promise<void> {
  const db = getDb();
  await db`
    UPDATE delegate_tenants
    SET capabilities = ${JSON.stringify(capabilities)}
    WHERE id = ${tenantId}
  `;
}

export async function updateTenantLastRefresh(tenantId: number): Promise<void> {
  const db = getDb();
  await db`
    UPDATE delegate_tenants SET last_refresh_at = NOW() WHERE id = ${tenantId}
  `;
}

// --- Delegate CRUD ---

export async function upsertDelegate(tenantId: number, delegate: {
  username: string;
  displayName: string;
  walletAddress?: string;
  kycStatus?: string | null;
  verifiedStatus?: boolean;
  programs?: string[];
  role?: string;
  isActive?: boolean;
  votesCast?: number;
  votesTotal?: number;
  votingPower?: string;
  notes?: string;
}): Promise<Delegate> {
  const db = getDb();
  const [row] = await db`
    INSERT INTO delegates (
      tenant_id, username, display_name, wallet_address, kyc_status,
      verified_status, programs, role, is_active, votes_cast, votes_total,
      voting_power, notes
    ) VALUES (
      ${tenantId},
      ${delegate.username},
      ${delegate.displayName},
      ${delegate.walletAddress || null},
      ${delegate.kycStatus || null},
      ${delegate.verifiedStatus ?? false},
      ${delegate.programs || []},
      ${delegate.role || null},
      ${delegate.isActive ?? true},
      ${delegate.votesCast ?? null},
      ${delegate.votesTotal ?? null},
      ${delegate.votingPower || null},
      ${delegate.notes || null}
    )
    ON CONFLICT (tenant_id, username) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      wallet_address = COALESCE(EXCLUDED.wallet_address, delegates.wallet_address),
      kyc_status = COALESCE(EXCLUDED.kyc_status, delegates.kyc_status),
      verified_status = COALESCE(EXCLUDED.verified_status, delegates.verified_status),
      programs = COALESCE(EXCLUDED.programs, delegates.programs),
      role = COALESCE(EXCLUDED.role, delegates.role),
      is_active = COALESCE(EXCLUDED.is_active, delegates.is_active),
      votes_cast = COALESCE(EXCLUDED.votes_cast, delegates.votes_cast),
      votes_total = COALESCE(EXCLUDED.votes_total, delegates.votes_total),
      voting_power = COALESCE(EXCLUDED.voting_power, delegates.voting_power),
      notes = COALESCE(EXCLUDED.notes, delegates.notes),
      updated_at = NOW()
    RETURNING *
  `;
  return mapDelegateRow(row);
}

export async function getDelegatesByTenant(tenantId: number): Promise<Delegate[]> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM delegates WHERE tenant_id = ${tenantId} ORDER BY display_name
  `;
  return rows.map(mapDelegateRow);
}

export async function getDelegateByUsername(
  tenantId: number,
  username: string
): Promise<Delegate | null> {
  const db = getDb();
  const [row] = await db`
    SELECT * FROM delegates WHERE tenant_id = ${tenantId} AND username = ${username}
  `;
  return row ? mapDelegateRow(row) : null;
}

// --- Snapshots ---

export async function createSnapshot(snapshot: {
  delegateId: number;
  tenantId: number;
  stats: DiscourseUserStats;
  rationaleCount: number;
  recentPosts: DiscourseUserPost[];
}): Promise<number> {
  const db = getDb();
  const [row] = await db`
    INSERT INTO delegate_snapshots (delegate_id, tenant_id, stats, rationale_count, recent_posts)
    VALUES (
      ${snapshot.delegateId},
      ${snapshot.tenantId},
      ${JSON.stringify(snapshot.stats)},
      ${snapshot.rationaleCount},
      ${JSON.stringify(snapshot.recentPosts)}
    )
    RETURNING id
  `;
  return row.id;
}

export async function getLatestSnapshots(tenantId: number): Promise<Map<number, DelegateSnapshot>> {
  const db = getDb();
  const rows = await db`
    SELECT DISTINCT ON (delegate_id) *
    FROM delegate_snapshots
    WHERE tenant_id = ${tenantId}
    ORDER BY delegate_id, captured_at DESC
  `;

  const map = new Map<number, DelegateSnapshot>();
  for (const row of rows) {
    map.set(row.delegate_id, mapSnapshotRow(row));
  }
  return map;
}

export async function getSnapshotHistory(
  delegateId: number,
  limit = 30
): Promise<DelegateSnapshot[]> {
  const db = getDb();
  const rows = await db`
    SELECT * FROM delegate_snapshots
    WHERE delegate_id = ${delegateId}
    ORDER BY captured_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapSnapshotRow);
}

// --- Dashboard assembly ---

export async function getDashboardData(slug: string): Promise<DelegateDashboard | null> {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return null;

  const delegates = await getDelegatesByTenant(tenant.id);
  const snapshots = await getLatestSnapshots(tenant.id);

  const delegateRows: DelegateRow[] = delegates.map((d) => {
    const snapshot = snapshots.get(d.id);
    const stats = snapshot?.stats;
    const voteRate =
      d.votesCast != null && d.votesTotal != null && d.votesTotal > 0
        ? Math.round((d.votesCast / d.votesTotal) * 100)
        : undefined;

    // Build avatar URL from template
    let avatarUrl = '';
    if (stats?.avatarTemplate) {
      const tpl = stats.avatarTemplate;
      avatarUrl = tpl.startsWith('http')
        ? tpl.replace('{size}', '120')
        : `${tenant.forumUrl}${tpl.replace('{size}', '120')}`;
    }

    return {
      username: d.username,
      displayName: d.displayName,
      avatarUrl,
      isActive: d.isActive,
      programs: d.programs || [],
      role: d.role ?? undefined,
      trustLevel: stats?.trustLevel ?? 0,
      topicCount: stats?.topicCount ?? 0,
      postCount: stats?.postCount ?? 0,
      likesGiven: stats?.likesGiven ?? 0,
      likesReceived: stats?.likesReceived ?? 0,
      daysVisited: stats?.daysVisited ?? 0,
      postsRead: stats?.postsRead ?? 0,
      lastSeenAt: stats?.lastSeenAt ?? null,
      lastPostedAt: stats?.lastPostedAt ?? null,
      rationaleCount: snapshot?.rationaleCount ?? 0,
      votesCast: d.votesCast ?? undefined,
      votesTotal: d.votesTotal ?? undefined,
      votingPower: d.votingPower ?? undefined,
      voteRate,
      walletAddress: d.walletAddress ?? undefined,
      kycStatus: d.kycStatus ?? undefined,
      verifiedStatus: d.verifiedStatus ?? undefined,
      notes: d.notes ?? undefined,
      dataSource: {
        forumStats: 'discourse_api',
        onChain: d.votesCast != null ? 'manual' : 'manual',
        identity: 'admin_provided',
      },
      snapshotAt: snapshot?.capturedAt ?? null,
    };
  });

  const summary = computeSummary(delegateRows);

  return {
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      forumUrl: tenant.forumUrl,
    },
    delegates: delegateRows,
    summary,
    lastRefreshAt: tenant.lastRefreshAt,
    capabilities: tenant.capabilities,
  };
}

// --- Helpers ---

function computeSummary(delegates: DelegateRow[]): DashboardSummary {
  const total = delegates.length;
  if (total === 0) {
    return {
      totalDelegates: 0,
      activeDelegates: 0,
      avgPostCount: 0,
      avgLikesReceived: 0,
      avgDaysVisited: 0,
      avgRationaleCount: 0,
      avgVoteRate: null,
      delegatesWithRationales: 0,
      delegatesSeenLast30Days: 0,
      delegatesPostedLast30Days: 0,
    };
  }

  const active = delegates.filter((d) => d.isActive);
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const seenLast30 = delegates.filter(
    (d) => d.lastSeenAt && new Date(d.lastSeenAt).getTime() > thirtyDaysAgo
  ).length;

  const postedLast30 = delegates.filter(
    (d) => d.lastPostedAt && new Date(d.lastPostedAt).getTime() > thirtyDaysAgo
  ).length;

  const withRationales = delegates.filter((d) => d.rationaleCount > 0).length;

  const voteRates = delegates
    .map((d) => d.voteRate)
    .filter((v): v is number => v != null);

  return {
    totalDelegates: total,
    activeDelegates: active.length,
    avgPostCount: Math.round(delegates.reduce((s, d) => s + d.postCount, 0) / total),
    avgLikesReceived: Math.round(delegates.reduce((s, d) => s + d.likesReceived, 0) / total),
    avgDaysVisited: Math.round(delegates.reduce((s, d) => s + d.daysVisited, 0) / total),
    avgRationaleCount: Math.round(delegates.reduce((s, d) => s + d.rationaleCount, 0) / total),
    avgVoteRate: voteRates.length > 0
      ? Math.round(voteRates.reduce((s, v) => s + v, 0) / voteRates.length)
      : null,
    delegatesWithRationales: withRationales,
    delegatesSeenLast30Days: seenLast30,
    delegatesPostedLast30Days: postedLast30,
  };
}

// --- Row mappers ---

function mapTenantRow(row: Record<string, unknown>): DelegateTenant {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    forumUrl: row.forum_url as string,
    apiUsername: row.api_username as string,
    encryptedApiKey: row.encrypted_api_key as string,
    config: (row.config || {}) as TenantConfig,
    capabilities: (row.capabilities || {}) as TenantCapabilities,
    isActive: row.is_active as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    lastRefreshAt: row.last_refresh_at ? (row.last_refresh_at as Date).toISOString() : null,
  };
}

function mapDelegateRow(row: Record<string, unknown>): Delegate {
  return {
    id: row.id as number,
    tenantId: row.tenant_id as number,
    username: row.username as string,
    displayName: row.display_name as string,
    walletAddress: row.wallet_address as string | undefined,
    kycStatus: row.kyc_status as Delegate['kycStatus'],
    verifiedStatus: row.verified_status as boolean | undefined,
    programs: row.programs as string[] | undefined,
    role: row.role as string | undefined,
    isActive: row.is_active as boolean,
    votesCast: row.votes_cast as number | undefined,
    votesTotal: row.votes_total as number | undefined,
    votingPower: row.voting_power as string | undefined,
    notes: row.notes as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function mapSnapshotRow(row: Record<string, unknown>): DelegateSnapshot {
  return {
    id: row.id as number,
    delegateId: row.delegate_id as number,
    tenantId: row.tenant_id as number,
    stats: row.stats as DiscourseUserStats,
    rationaleCount: row.rationale_count as number,
    recentPosts: (row.recent_posts || []) as DiscourseUserPost[],
    capturedAt: (row.captured_at as Date).toISOString(),
  };
}
