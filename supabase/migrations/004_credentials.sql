-- ============================================
-- Phase 5: Credentials Vault (ct_credentials)
-- Stores encrypted API keys/tokens in client DB
-- ============================================

CREATE TABLE IF NOT EXISTS ct_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(50) NOT NULL,
  credential_key VARCHAR(100) NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service, credential_key)
);

CREATE INDEX IF NOT EXISTS idx_credentials_service ON ct_credentials(service);

