-- Sala de Comando, Fase 2: tabelas que faltavam nas
-- migrations versionadas (necessarias pra instalacao limpa do Kit do zero).
-- Colunas conferidas em producao em 2026-09-12. Aditiva e idempotente: no-op se as tabelas ja existirem.

create table if not exists public.ct_agent_prompts (
  id uuid primary key default gen_random_uuid(),
  agent_slug varchar not null unique,
  prompt_md text,
  config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ct_skills (
  slug text primary key,
  name text,
  description text,
  category text,
  content text,
  path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true
);

alter table public.ct_content_items add column if not exists client_slug text;
alter table public.ct_content_items add column if not exists captions_by_platform jsonb;
alter table public.ct_content_items add column if not exists account_id uuid;
alter table public.ct_content_items add column if not exists traffic_type varchar;

create index if not exists idx_ct_content_client_slug on public.ct_content_items (client_slug);
