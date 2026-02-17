-- Delegate Monitoring Schema
-- Multi-tenant delegate activity tracking for Discourse forums

-- Tenants table - each DAO/community that uses delegate monitoring
CREATE TABLE IF NOT EXISTS delegate_tenants (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,                    -- URL slug, e.g. "my-dao"
  name TEXT NOT NULL,                           -- Display name, e.g. "My DAO"
  forum_url TEXT NOT NULL,                      -- Discourse base URL
  api_username TEXT NOT NULL,                   -- Discourse API username
  encrypted_api_key TEXT NOT NULL,              -- AES-256-GCM encrypted
  config JSONB DEFAULT '{}'::jsonb,             -- TenantConfig (rationale patterns, programs, etc.)
  capabilities JSONB DEFAULT '{}'::jsonb,       -- TenantCapabilities (discovered on first connect)
  is_active BOOLEAN DEFAULT true,
  last_refresh_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delegates table - delegate roster per tenant
CREATE TABLE IF NOT EXISTS delegates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES delegate_tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,                        -- Discourse username
  display_name TEXT NOT NULL,                    -- Admin-provided display name
  -- Manual identity fields
  wallet_address TEXT,
  kyc_status TEXT CHECK (kyc_status IN ('verified', 'pending', 'not_required')),
  verified_status BOOLEAN DEFAULT false,
  programs TEXT[] DEFAULT '{}',                  -- e.g. {"GCR", "DCP"}
  is_active BOOLEAN DEFAULT true,
  -- On-chain (manual for POC)
  votes_cast INTEGER,
  votes_total INTEGER,
  voting_power TEXT,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, username)
);

-- Delegate snapshots - timestamped stat captures for trending
CREATE TABLE IF NOT EXISTS delegate_snapshots (
  id SERIAL PRIMARY KEY,
  delegate_id INTEGER NOT NULL REFERENCES delegates(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES delegate_tenants(id) ON DELETE CASCADE,
  -- Full Discourse user stats at capture time
  stats JSONB NOT NULL,                          -- DiscourseUserStats
  -- Computed fields
  rationale_count INTEGER DEFAULT 0,
  recent_posts JSONB DEFAULT '[]'::jsonb,        -- Last N posts
  -- Timestamp
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delegate_tenants_slug ON delegate_tenants(slug);
CREATE INDEX IF NOT EXISTS idx_delegates_tenant_id ON delegates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delegates_username ON delegates(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_delegate_snapshots_delegate ON delegate_snapshots(delegate_id);
CREATE INDEX IF NOT EXISTS idx_delegate_snapshots_tenant ON delegate_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_delegate_snapshots_captured ON delegate_snapshots(captured_at DESC);
-- Composite index for "latest snapshot per delegate" query
CREATE INDEX IF NOT EXISTS idx_delegate_snapshots_delegate_captured 
  ON delegate_snapshots(delegate_id, captured_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_delegates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_delegate_tenants_updated_at ON delegate_tenants;
CREATE TRIGGER update_delegate_tenants_updated_at
  BEFORE UPDATE ON delegate_tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_delegates_updated_at();

DROP TRIGGER IF EXISTS update_delegates_updated_at ON delegates;
CREATE TRIGGER update_delegates_updated_at
  BEFORE UPDATE ON delegates
  FOR EACH ROW
  EXECUTE FUNCTION update_delegates_updated_at();
