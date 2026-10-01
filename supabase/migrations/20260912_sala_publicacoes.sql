-- Sala de Comando, Batelada B6: Calendário passa a mostrar tudo que saiu em cada rede,
-- inclusive o que foi postado à mão fora da Sala. Fonte única: ct_publications.
--
-- ct_publications já existe na nuvem (painel antigo, src/app/api/publish/route.ts, com
-- content_item_id/platform/status/scheduled_at/caption/media_ids/...). Aditiva e idempotente
-- aqui: cria a tabela só se faltar (banco local vazio, sem essas linhas antigas) e SEMPRE
-- garante, via add column if not exists, as colunas que o Calendário da Sala precisa, sem
-- tocar nas colunas nem nos dados que o painel antigo já usa.
--
-- Aplicada por scripts/sala/apply-migrations.mjs (registro em ct_sala_migrations).

create table if not exists public.ct_publications (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid,
  platform text,
  status text,
  scheduled_at timestamptz,
  caption text,
  media_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  external_id text,
  external_url text,
  error_message text,
  retry_count integer not null default 0
);

alter table public.ct_publications add column if not exists client_slug text;
alter table public.ct_publications add column if not exists rede text;
alter table public.ct_publications add column if not exists tipo text;
alter table public.ct_publications add column if not exists url text;
alter table public.ct_publications add column if not exists publicado_em timestamptz;
alter table public.ct_publications add column if not exists origem text;
alter table public.ct_publications add column if not exists titulo text;
alter table public.ct_publications add column if not exists capa_url text;
alter table public.ct_publications add column if not exists metricas jsonb not null default '{}'::jsonb;

-- Enumeração documentada na spec (seção 5): tipo = feed, reel, story, post, video, short;
-- origem = sala, api, manual. Guardado em do-block pra ser idempotente (add constraint
-- if not exists não existe no Postgres).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ck_ct_publications_tipo') then
    alter table public.ct_publications
      add constraint ck_ct_publications_tipo
      check (tipo is null or tipo in ('feed', 'reel', 'story', 'post', 'video', 'short'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ck_ct_publications_origem') then
    alter table public.ct_publications
      add constraint ck_ct_publications_origem
      check (origem is null or origem in ('sala', 'api', 'manual'));
  end if;
end
$$;

-- Índice único que o upsert do sync usa (client_slug, rede, url). Parcial (url not null)
-- porque nem toda linha antiga do painel tem client_slug/rede/url preenchidos.
create unique index if not exists uq_ct_publications_client_rede_url
  on public.ct_publications (client_slug, rede, url)
  where url is not null;

create index if not exists idx_ct_publications_client_slug on public.ct_publications (client_slug);
