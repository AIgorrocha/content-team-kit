-- Tabelas gravadas por scripts/analytics e crons que nenhuma migration criava (auditoria 07/set/2026).
-- DDL extraida do banco em producao. Idempotente. Roda antes das migrations datadas (2026*).
-- Deps: ct_content_items (001_content_team.sql).

create table if not exists public.ct_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  platform text not null,
  account_handle text,
  grain text not null default 'post',
  post_id text not null,
  post_url text,
  post_type text,
  published_at timestamptz,
  snapshot_date date not null default current_date,
  followers integer,
  reach integer,
  impressions integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  views integer,
  engagement_rate numeric,
  metrics jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz not null default now(),
  constraint uq_ct_metrics_post_day unique (platform, post_id, snapshot_date)
);
create index if not exists idx_ct_metrics_client_platform_date on public.ct_metrics_snapshots (client_slug, platform, snapshot_date desc);
create index if not exists idx_ct_metrics_bucket on public.ct_metrics_snapshots (client_slug, platform, published_at);

create table if not exists public.ct_social_insights (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  platform text not null,
  kind text not null default 'best_time',
  window_days integer,
  sample_size integer,
  payload jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);
create index if not exists idx_ct_social_insights_latest on public.ct_social_insights (client_slug, platform, kind, computed_at desc);

-- Base do ct_notebooks (NotebookLM). 20260414_ct_notebooks_extend.sql adiciona o resto com IF NOT EXISTS.
create table if not exists public.ct_notebooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  client_slug text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  artifacts jsonb default '{}'::jsonb
);
