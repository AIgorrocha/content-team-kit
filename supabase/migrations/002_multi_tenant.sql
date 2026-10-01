-- ============================================
-- Content Team AI - Multi-Tenant (Central DB)
-- Only auth/tenant tables live here.
-- Content tables live in each client's own DB.
-- ============================================

-- Users (auth)
CREATE TABLE IF NOT EXISTS ct_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(200) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenants (workspaces)
CREATE TABLE IF NOT EXISTS ct_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  database_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant members (who belongs to which workspace)
CREATE TABLE IF NOT EXISTS ct_tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ct_tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES ct_users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- API keys (for external agent runtime integration)
CREATE TABLE IF NOT EXISTS ct_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ct_tenants(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  label VARCHAR(100) NOT NULL DEFAULT 'default',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ct_users_email ON ct_users(email);
CREATE INDEX IF NOT EXISTS idx_ct_tenants_slug ON ct_tenants(slug);
CREATE INDEX IF NOT EXISTS idx_ct_tenant_members_user ON ct_tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ct_tenant_members_tenant ON ct_tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ct_api_keys_tenant ON ct_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ct_api_keys_hash ON ct_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_ct_api_keys_prefix ON ct_api_keys(key_prefix);
