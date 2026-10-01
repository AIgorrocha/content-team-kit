-- Tabelas que scripts e skills ja usam e nenhuma migration criava (auditoria 30/set/2026).
-- Colunas deduzidas do codigo que grava e le cada uma:
--   anuncios: scripts/infra/ads-sync-daily.mjs, scripts/infra/ads-approval-worker.mjs, src/app/api/ads/*
--   posts: skills/ct-publicar-ig e skills/ct-publicar-li (chamadas REST com a chave de servico)
--   inspiracao: skills/ct-ig-saved-inspiration/scrape.mjs
-- Aditiva e idempotente (create ... if not exists). Depende de ct_instagram_accounts
-- (20260912_sala_colunas_concorrentes.sql, que vem antes na ordem de nome).
-- RLS ligada sem politicas, igual as outras tabelas ct_* da Sala: so o servidor
-- (chave de servico ou conexao privilegiada) acessa; anon/authenticated nao.

-- ---------- Anuncios (Meta Ads) ----------

create table if not exists public.ct_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ct_instagram_accounts(id) on delete cascade,
  meta_campaign_id text not null,
  name text,
  objective text,
  status text,
  daily_budget numeric,
  lifetime_budget numeric,
  start_date timestamptz,
  end_date timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  metrics_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ct_ad_campaigns_account_meta unique (account_id, meta_campaign_id)
);
create index if not exists idx_ct_ad_campaigns_status on public.ct_ad_campaigns (status);

-- campaign_id aqui e o ID da campanha na Meta (texto), nao o uuid de ct_ad_campaigns.
create table if not exists public.ct_ad_insights (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  date date not null,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  spend numeric not null default 0,
  cpc numeric not null default 0,
  ctr numeric not null default 0,
  cpm numeric not null default 0,
  landing_page_views integer not null default 0,
  video_views integer not null default 0,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint uq_ct_ad_insights_campaign_date unique (campaign_id, date)
);
create index if not exists idx_ct_ad_insights_date on public.ct_ad_insights (date desc);

-- Recomendacoes geradas pelo agente ct-trafego (agents/ct-trafego.md, "Analise Diaria").
create table if not exists public.ct_ad_recommendations (
  id uuid primary key default gen_random_uuid(),
  campaign_id text,
  type text,
  severity text not null default 'info',
  title text,
  message text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists idx_ct_ad_recommendations_campaign on public.ct_ad_recommendations (campaign_id, created_at desc);

-- Fila de aprovacoes humanas: pending -> approved (no painel) -> executed | failed (worker).
create table if not exists public.ct_ad_approvals (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid references public.ct_ad_recommendations(id) on delete set null,
  campaign_id text not null,
  action_type text not null,
  proposed_value text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  executed_at timestamptz,
  executed_by text
);
create index if not exists idx_ct_ad_approvals_status on public.ct_ad_approvals (status, executed_at);

-- Historico de tudo que foi mudado em campanha (painel e worker).
create table if not exists public.ct_ad_actions_log (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  action_type text not null,
  old_value text,
  new_value text,
  executed_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ct_ad_actions_log_campaign on public.ct_ad_actions_log (campaign_id, created_at desc);

-- ---------- Registro de posts publicados por skill ----------

create table if not exists public.ct_instagram_posts (
  id uuid primary key default gen_random_uuid(),
  client_slug text,
  caption text,
  image_url text,
  media_type text not null default 'IMAGE',
  hashtags jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  ig_container_id text,
  ig_media_id text,
  ig_permalink text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ct_instagram_posts_status on public.ct_instagram_posts (status, created_at desc);

create table if not exists public.ct_linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  client_slug text,
  caption text,
  media_type text not null default 'NONE',
  status text not null default 'draft',
  li_post_urn text,
  li_post_url text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ct_linkedin_posts_status on public.ct_linkedin_posts (status, created_at desc);

-- ---------- Inspiracao: posts salvos no Instagram ----------

create table if not exists public.ct_saved_inspiration (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  shortcode text not null,
  author_handle text,
  url text,
  media_type text,
  caption text,
  transcript text,
  frames_path text,
  analysis jsonb,
  idea text,
  status text not null default 'new',
  saved_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint uq_ct_saved_inspiration_client_shortcode unique (client_slug, shortcode)
);
create index if not exists idx_ct_saved_inspiration_status on public.ct_saved_inspiration (client_slug, status);

-- ---------- RLS (sem politicas publicas) ----------

alter table public.ct_ad_campaigns enable row level security;
alter table public.ct_ad_insights enable row level security;
alter table public.ct_ad_recommendations enable row level security;
alter table public.ct_ad_approvals enable row level security;
alter table public.ct_ad_actions_log enable row level security;
alter table public.ct_instagram_posts enable row level security;
alter table public.ct_linkedin_posts enable row level security;
alter table public.ct_saved_inspiration enable row level security;
