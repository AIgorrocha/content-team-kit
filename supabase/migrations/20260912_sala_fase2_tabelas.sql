-- Sala de Comando, Fase 2: tabelas novas (revisoes, etapas, eventos, regras, conexoes).
-- Aditiva e idempotente: so create table/index if not exists. Nunca drop, nunca altera dado existente.
-- Aplicada por scripts/sala/apply-migrations.mjs (registro em ct_sala_migrations).

create table if not exists public.ct_sala_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.ct_piece_revisions (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  piece_slug text not null,
  numero integer not null,
  artefatos jsonb not null default '{}'::jsonb,
  criada_em timestamptz not null default now(),
  criada_por text
);
create index if not exists idx_ct_piece_revisions_piece_slug on public.ct_piece_revisions (piece_slug);
create index if not exists idx_ct_piece_revisions_client_slug on public.ct_piece_revisions (client_slug);

create table if not exists public.ct_piece_stages (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  piece_slug text not null,
  parent_slug text,
  piece_type text not null,
  stage integer not null check (stage between 1 and 8),
  status text not null default 'pendente' check (status in (
    'pendente', 'em_andamento', 'aguardando_aprovacao', 'aprovado', 'ajuste', 'concluido', 'nao_se_aplica'
  )),
  rede text,
  revisao_id uuid references public.ct_piece_revisions (id),
  dono_agente text,
  aprovado_em timestamptz,
  aprovado_por text,
  motivo_ajuste text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- unique(piece_slug, stage, rede) tratando rede nula como '' (coalesce), via indice de expressao.
create unique index if not exists uq_ct_piece_stages_piece_stage_rede
  on public.ct_piece_stages (piece_slug, stage, coalesce(rede, ''));
create index if not exists idx_ct_piece_stages_client_slug on public.ct_piece_stages (client_slug);
create index if not exists idx_ct_piece_stages_piece_slug on public.ct_piece_stages (piece_slug);

create table if not exists public.ct_agent_events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  client_slug text,
  agent text,
  event text,
  tool text,
  task_id text,
  parent_id text,
  piece_slug text,
  payload jsonb not null default '{}'::jsonb,
  source text check (source in ('site', 'terminal')),
  dedupe_key text unique
);
create index if not exists idx_ct_agent_events_client_slug on public.ct_agent_events (client_slug);
create index if not exists idx_ct_agent_events_piece_slug on public.ct_agent_events (piece_slug);
create index if not exists idx_ct_agent_events_ts on public.ct_agent_events (ts desc);

-- Realtime: adiciona ct_agent_events na publicacao supabase_realtime sem falhar se ja
-- estiver adicionada ou se a publicacao nao existir (ex: Postgres local descartavel de teste).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ct_agent_events'
    ) then
      alter publication supabase_realtime add table public.ct_agent_events;
    end if;
  end if;
end
$$;

create table if not exists public.ct_rules (
  id uuid primary key default gen_random_uuid(),
  client_slug text,
  scope text not null check (scope in ('client', 'generic')),
  file_path text not null,
  rule_key text not null,
  content_type text,
  label text check (label in ('FIXA', 'REINCIDENTE', 'HIPOTESE', 'MEDIDO', 'MECANICA')),
  text text,
  file_hash text,
  updated_at timestamptz not null default now()
);
create index if not exists idx_ct_rules_client_slug on public.ct_rules (client_slug);

create table if not exists public.ct_connections (
  id uuid primary key default gen_random_uuid(),
  client_slug text,
  service text not null,
  account_label text,
  account_id_externo text,
  obtained_at timestamptz,
  expires_at timestamptz,
  status text,
  renew_kind text,
  last_checked_at timestamptz,
  last_used_at timestamptz,
  credential_ref uuid
);
create index if not exists idx_ct_connections_client_slug on public.ct_connections (client_slug);
