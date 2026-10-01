-- Metricas por post do Instagram (gravadas por src/lib/integrations/instagram.ts) e ligacao
-- opcional de uma publicacao com a campanha que a impulsionou (lida pela tela organico x pago,
-- src/app/api/analytics/organic-vs-paid). Nenhuma migration criava estas estruturas.
-- Aditiva e idempotente. Depende de ct_instagram_accounts, ct_publications e ct_ad_campaigns.

create table if not exists public.ct_instagram_metrics (
  id uuid primary key default gen_random_uuid(),
  media_id text not null unique,
  account_id uuid references public.ct_instagram_accounts(id) on delete cascade,
  caption text,
  media_type text,
  timestamp timestamptz,
  permalink text,
  like_count integer not null default 0,
  comments_count integer not null default 0,
  impressions integer not null default 0,
  reach integer not null default 0,
  engagement integer not null default 0,
  saved integer not null default 0,
  shares integer not null default 0,
  collected_at timestamptz not null default now()
);
create index if not exists idx_ct_instagram_metrics_account on public.ct_instagram_metrics (account_id);
alter table public.ct_instagram_metrics enable row level security;

alter table public.ct_publications
  add column if not exists boost_campaign_id uuid references public.ct_ad_campaigns(id) on delete set null;
