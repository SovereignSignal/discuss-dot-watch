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

let _schemaReady = false;
let _schemaPromise: Promise<void> | null = null;

/** Ensure schema migrations have been applied (runs once per process). */
export async function ensureSchema() {
  if (_schemaReady) return;
  if (_schemaPromise) return _schemaPromise;
  _schemaPromise = initializeDelegateSchema().then(() => { _schemaReady = true; }).catch((err) => {
    _schemaPromise = null; // Allow retry on failure
    throw err;
  });
  return _schemaPromise;
}

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
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS is_tracked BOOLEAN DEFAULT false`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS directory_post_count INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS directory_topic_count INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS directory_likes_received INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS directory_likes_given INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS directory_days_visited INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS directory_posts_read INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS directory_topics_entered INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS post_count_percentile INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS likes_received_percentile INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS days_visited_percentile INTEGER`;
  await db`ALTER TABLE delegates ADD COLUMN IF NOT EXISTS topics_entered_percentile INTEGER`;

  // Backfill: pre-existing delegates (before directory sync feature) should be marked as tracked.
  // Only affects rows with no directory data (directory_post_count IS NULL), so
  // auto-synced contributors won't be flipped to tracked on subsequent runs.
  await db`UPDATE delegates SET is_tracked = true WHERE is_tracked = false AND directory_post_count IS NULL`;

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

export async function updateTenant(tenantId: number, updates: {
  name?: string;
  forumUrl?: string;
  apiUsername?: string;
  encryptedApiKey?: string;
  config?: TenantConfig;
}): Promise<void> {
  const db = getDb();
  // Build SET clauses dynamically for provided fields
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.forumUrl !== undefined) {
    sets.push(`forum_url = $${paramIndex++}`);
    values.push(updates.forumUrl);
  }
  if (updates.apiUsername !== undefined) {
    sets.push(`api_username = $${paramIndex++}`);
    values.push(updates.apiUsername);
  }
  if (updates.encryptedApiKey !== undefined) {
    sets.push(`encrypted_api_key = $${paramIndex++}`);
    values.push(updates.encryptedApiKey);
  }
  if (updates.config !== undefined) {
    sets.push(`config = $${paramIndex++}`);
    values.push(JSON.stringify(updates.config));
  }

  if (values.length === 0) return; // Nothing to update besides updated_at

  // Use raw unsafe query since we're building dynamic SQL
  await db.unsafe(
    `UPDATE delegate_tenants SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
    [...values, tenantId] as (string | number | boolean | null)[]
  );
}

export async function deleteTenant(tenantId: number): Promise<boolean> {
  const db = getDb();
  // CASCADE deletes delegates and snapshots via FK constraints
  const [row] = await db`DELETE FROM delegate_tenants WHERE id = ${tenantId} RETURNING id`;
  return !!row;
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
  isTracked?: boolean;
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
  directoryPostCount?: number;
  directoryTopicCount?: number;
  directoryLikesReceived?: number;
  directoryLikesGiven?: number;
  directoryDaysVisited?: number;
  directoryPostsRead?: number;
  directoryTopicsEntered?: number;
  postCountPercentile?: number;
  likesReceivedPercentile?: number;
  daysVisitedPercentile?: number;
  topicsEnteredPercentile?: number;
}): Promise<Delegate> {
  await ensureSchema();
  const db = getDb();
  const [row] = await db`
    INSERT INTO delegates (
      tenant_id, username, display_name, is_tracked, wallet_address, kyc_status,
      verified_status, programs, role, is_active, votes_cast, votes_total,
      voting_power, notes,
      directory_post_count, directory_topic_count, directory_likes_received,
      directory_likes_given, directory_days_visited, directory_posts_read,
      directory_topics_entered,
      post_count_percentile, likes_received_percentile, days_visited_percentile,
      topics_entered_percentile
    ) VALUES (
      ${tenantId},
      ${delegate.username},
      ${delegate.displayName},
      ${delegate.isTracked ?? false},
      ${delegate.walletAddress || null},
      ${delegate.kycStatus || null},
      ${delegate.verifiedStatus ?? false},
      ${delegate.programs || []},
      ${delegate.role || null},
      ${delegate.isActive ?? true},
      ${delegate.votesCast ?? null},
      ${delegate.votesTotal ?? null},
      ${delegate.votingPower || null},
      ${delegate.notes || null},
      ${delegate.directoryPostCount ?? null},
      ${delegate.directoryTopicCount ?? null},
      ${delegate.directoryLikesReceived ?? null},
      ${delegate.directoryLikesGiven ?? null},
      ${delegate.directoryDaysVisited ?? null},
      ${delegate.directoryPostsRead ?? null},
      ${delegate.directoryTopicsEntered ?? null},
      ${delegate.postCountPercentile ?? null},
      ${delegate.likesReceivedPercentile ?? null},
      ${delegate.daysVisitedPercentile ?? null},
      ${delegate.topicsEnteredPercentile ?? null}
    )
    ON CONFLICT (tenant_id, username) DO UPDATE SET
      display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), delegates.display_name),
      is_tracked = GREATEST(EXCLUDED.is_tracked, delegates.is_tracked),
      wallet_address = COALESCE(EXCLUDED.wallet_address, delegates.wallet_address),
      kyc_status = COALESCE(EXCLUDED.kyc_status, delegates.kyc_status),
      verified_status = COALESCE(EXCLUDED.verified_status, delegates.verified_status),
      programs = COALESCE(NULLIF(EXCLUDED.programs, '{}'), delegates.programs),
      role = COALESCE(EXCLUDED.role, delegates.role),
      is_active = COALESCE(EXCLUDED.is_active, delegates.is_active),
      votes_cast = COALESCE(EXCLUDED.votes_cast, delegates.votes_cast),
      votes_total = COALESCE(EXCLUDED.votes_total, delegates.votes_total),
      voting_power = COALESCE(EXCLUDED.voting_power, delegates.voting_power),
      notes = COALESCE(EXCLUDED.notes, delegates.notes),
      directory_post_count = COALESCE(EXCLUDED.directory_post_count, delegates.directory_post_count),
      directory_topic_count = COALESCE(EXCLUDED.directory_topic_count, delegates.directory_topic_count),
      directory_likes_received = COALESCE(EXCLUDED.directory_likes_received, delegates.directory_likes_received),
      directory_likes_given = COALESCE(EXCLUDED.directory_likes_given, delegates.directory_likes_given),
      directory_days_visited = COALESCE(EXCLUDED.directory_days_visited, delegates.directory_days_visited),
      directory_posts_read = COALESCE(EXCLUDED.directory_posts_read, delegates.directory_posts_read),
      directory_topics_entered = COALESCE(EXCLUDED.directory_topics_entered, delegates.directory_topics_entered),
      post_count_percentile = COALESCE(EXCLUDED.post_count_percentile, delegates.post_count_percentile),
      likes_received_percentile = COALESCE(EXCLUDED.likes_received_percentile, delegates.likes_received_percentile),
      days_visited_percentile = COALESCE(EXCLUDED.days_visited_percentile, delegates.days_visited_percentile),
      topics_entered_percentile = COALESCE(EXCLUDED.topics_entered_percentile, delegates.topics_entered_percentile),
      updated_at = NOW()
    RETURNING *
  `;
  return mapDelegateRow(row);
}

export async function getDelegatesByTenant(tenantId: number, opts?: { trackedOnly?: boolean }): Promise<Delegate[]> {
  const db = getDb();
  const rows = opts?.trackedOnly
    ? await db`SELECT * FROM delegates WHERE tenant_id = ${tenantId} AND is_tracked = true ORDER BY display_name`
    : await db`SELECT * FROM delegates WHERE tenant_id = ${tenantId} ORDER BY display_name`;
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

export async function deleteDelegate(tenantId: number, username: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db`
    DELETE FROM delegates WHERE tenant_id = ${tenantId} AND username = ${username} RETURNING id
  `;
  return !!row;
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

export async function getDashboardData(slug: string, opts?: { trackedOnly?: boolean }): Promise<DelegateDashboard | null> {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return null;

  const delegates = await getDelegatesByTenant(tenant.id, opts);
  const snapshots = await getLatestSnapshots(tenant.id);

  // Count tracked members from full roster (for showing toggle)
  const trackedCount = opts?.trackedOnly
    ? delegates.length  // Already filtered
    : delegates.filter((d) => d.isTracked).length;

  const delegateRows: DelegateRow[] = delegates.map((d) => {
    const snapshot = snapshots.get(d.id);
    const stats = snapshot?.stats;
    const hasSnapshot = !!stats;
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

    // Use snapshot stats when available, fall back to directory stats
    return {
      username: d.username,
      displayName: d.displayName,
      avatarUrl,
      isActive: d.isActive,
      isTracked: d.isTracked,
      programs: d.programs || [],
      role: d.role ?? undefined,
      trustLevel: stats?.trustLevel ?? 0,
      topicCount: hasSnapshot ? (stats?.topicCount ?? 0) : (d.directoryTopicCount ?? 0),
      postCount: hasSnapshot ? (stats?.postCount ?? 0) : (d.directoryPostCount ?? 0),
      likesGiven: hasSnapshot ? (stats?.likesGiven ?? 0) : (d.directoryLikesGiven ?? 0),
      likesReceived: hasSnapshot ? (stats?.likesReceived ?? 0) : (d.directoryLikesReceived ?? 0),
      daysVisited: hasSnapshot ? (stats?.daysVisited ?? 0) : (d.directoryDaysVisited ?? 0),
      postsRead: hasSnapshot ? (stats?.postsRead ?? 0) : (d.directoryPostsRead ?? 0),
      lastSeenAt: stats?.lastSeenAt ?? null,
      lastPostedAt: stats?.lastPostedAt ?? null,
      postCountPercentile: d.postCountPercentile ?? undefined,
      likesReceivedPercentile: d.likesReceivedPercentile ?? undefined,
      daysVisitedPercentile: d.daysVisitedPercentile ?? undefined,
      topicsEnteredPercentile: d.topicsEnteredPercentile ?? undefined,
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
        forumStats: hasSnapshot ? 'discourse_api' : 'directory',
        onChain: d.votesCast != null ? 'manual' : 'manual',
        identity: d.isTracked ? 'admin_provided' : 'directory',
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
      branding: tenant.config.branding,
      trackedMemberLabel: tenant.config.trackedMemberLabel,
      trackedMemberLabelPlural: tenant.config.trackedMemberLabelPlural,
    },
    delegates: delegateRows,
    summary,
    trackedCount,
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

function parseJsonb<T>(val: unknown, fallback: T): T {
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return (val || fallback) as T;
}

function mapTenantRow(row: Record<string, unknown>): DelegateTenant {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    forumUrl: row.forum_url as string,
    apiUsername: row.api_username as string,
    encryptedApiKey: row.encrypted_api_key as string,
    config: parseJsonb<TenantConfig>(row.config, {}),
    capabilities: parseJsonb<TenantCapabilities>(row.capabilities, {}),
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
    isTracked: (row.is_tracked as boolean) ?? false,
    walletAddress: row.wallet_address as string | undefined,
    kycStatus: row.kyc_status as Delegate['kycStatus'],
    verifiedStatus: row.verified_status as boolean | undefined,
    programs: row.programs as string[] | undefined,
    role: row.role as string | undefined,
    isActive: row.is_active as boolean,
    votesCast: row.votes_cast as number | undefined,
    votesTotal: row.votes_total as number | undefined,
    votingPower: row.voting_power as string | undefined,
    directoryPostCount: row.directory_post_count as number | undefined,
    directoryTopicCount: row.directory_topic_count as number | undefined,
    directoryLikesReceived: row.directory_likes_received as number | undefined,
    directoryLikesGiven: row.directory_likes_given as number | undefined,
    directoryDaysVisited: row.directory_days_visited as number | undefined,
    directoryPostsRead: row.directory_posts_read as number | undefined,
    directoryTopicsEntered: row.directory_topics_entered as number | undefined,
    postCountPercentile: row.post_count_percentile as number | undefined,
    likesReceivedPercentile: row.likes_received_percentile as number | undefined,
    daysVisitedPercentile: row.days_visited_percentile as number | undefined,
    topicsEnteredPercentile: row.topics_entered_percentile as number | undefined,
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
    stats: parseJsonb<DiscourseUserStats>(row.stats, {} as DiscourseUserStats),
    rationaleCount: row.rationale_count as number,
    recentPosts: parseJsonb<DiscourseUserPost[]>(row.recent_posts, []),
    capturedAt: (row.captured_at as Date).toISOString(),
  };
}
