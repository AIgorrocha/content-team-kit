-- ============================================
-- Content Team AI - Billing & Subscriptions (Central DB)
-- Plans, subscriptions, and usage tracking
-- ============================================

-- Plans (pricing tiers)
CREATE TABLE IF NOT EXISTS ct_plans (
  id VARCHAR(50) PRIMARY KEY,           -- 'free', 'starter', 'pro', 'enterprise'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,   -- centavos (R$)
  price_yearly INTEGER NOT NULL DEFAULT 0,    -- centavos (R$)
  limits JSONB NOT NULL DEFAULT '{}',
  features TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions (one per tenant)
CREATE TABLE IF NOT EXISTS ct_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ct_tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL REFERENCES ct_plans(id),
  status VARCHAR(30) NOT NULL DEFAULT 'active',  -- active, cancelled, past_due, trialing
  billing_cycle VARCHAR(10) NOT NULL DEFAULT 'monthly', -- monthly, yearly
  provider VARCHAR(30),                -- 'stripe', 'manual'
  provider_subscription_id TEXT,       -- ID externo (Stripe)
  provider_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Usage tracking (monthly snapshots)
CREATE TABLE IF NOT EXISTS ct_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ct_tenants(id) ON DELETE CASCADE,
  period VARCHAR(7) NOT NULL,          -- '2026-03' (YYYY-MM)
  agents_used INTEGER DEFAULT 0,
  tasks_executed INTEGER DEFAULT 0,
  content_created INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, period)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ct_subscriptions_tenant ON ct_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ct_subscriptions_status ON ct_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_ct_subscriptions_provider ON ct_subscriptions(provider, provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_ct_usage_tenant_period ON ct_usage(tenant_id, period);

-- Seed default plans
INSERT INTO ct_plans (id, name, description, price_monthly, price_yearly, limits, features, sort_order)
VALUES
  ('free', 'Grátis', 'Para testar a plataforma', 0, 0,
   '{"agents": 3, "tasks_per_month": 50, "content_per_month": 20, "emails_per_month": 100, "storage_mb": 500}',
   ARRAY['3 agentes', '50 tarefas/mês', '20 conteúdos/mês', '100 emails/mês', '500MB armazenamento'],
   0),
  ('starter', 'Starter', 'Para criadores de conteúdo solo', 9700, 97000,
   '{"agents": 6, "tasks_per_month": 200, "content_per_month": 100, "emails_per_month": 1000, "storage_mb": 5000}',
   ARRAY['6 agentes', '200 tarefas/mês', '100 conteúdos/mês', '1.000 emails/mês', '5GB armazenamento', 'CRM básico', 'Suporte por email'],
   1),
  ('pro', 'Pro', 'Para equipes e agências', 29700, 297000,
   '{"agents": 12, "tasks_per_month": -1, "content_per_month": -1, "emails_per_month": 10000, "storage_mb": 50000}',
   ARRAY['12 agentes (todos)', 'Tarefas ilimitadas', 'Conteúdos ilimitados', '10.000 emails/mês', '50GB armazenamento', 'CRM completo', 'Análise de concorrentes', 'Suporte prioritário'],
   2),
  ('enterprise', 'Enterprise', 'Para grandes operações', 0, 0,
   '{"agents": -1, "tasks_per_month": -1, "content_per_month": -1, "emails_per_month": -1, "storage_mb": -1}',
   ARRAY['Agentes ilimitados', 'Tudo ilimitado', 'API dedicada', 'Onboarding personalizado', 'SLA garantido', 'Suporte 24/7'],
   3)
ON CONFLICT (id) DO NOTHING;
