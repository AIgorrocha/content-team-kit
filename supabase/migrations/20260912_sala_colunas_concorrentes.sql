-- A copia dos dados da nuvem do cliente para o banco local em 2026-09-12 falhou em
-- ct_competitors e ct_instagram_accounts por coluna ausente nas migrations do Kit.
-- Aditiva e idempotente: criação e colunas com IF NOT EXISTS, sem alterar dados existentes.
-- Aplicada por scripts/sala/apply-migrations.mjs (registro em ct_sala_migrations).

-- Em uma instalação limpa, ct_competitors só existe depois das migrations antigas.
-- A guarda mantém esta migration aplicável tanto na nuvem já instalada quanto antes
-- da migration 001 quando o aplicador roda apenas o conjunto da Sala.
do $$
begin
  if to_regclass('public.ct_competitors') is not null then
    alter table public.ct_competitors
      add column if not exists profile_url text,
      add column if not exists social_links jsonb default '{}'::jsonb,
      add column if not exists followers_count integer,
      add column if not exists bio text;
  end if;
end
$$;

-- ct_instagram_accounts só era criada em instalacao_final, que vem depois na ordem
-- lexicográfica. A definição completa aqui evita uma dependência de ordem em banco vazio.
create table if not exists public.ct_instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  ig_user_id text not null,
  access_token text not null,
  ad_account_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name varchar,
  token_expires_at timestamptz,
  fb_page_id varchar,
  client_slug varchar,
  last_synced_at timestamptz
);

alter table public.ct_instagram_accounts
  add column if not exists display_name varchar,
  add column if not exists token_expires_at timestamptz,
  add column if not exists fb_page_id varchar,
  add column if not exists client_slug varchar,
  add column if not exists last_synced_at timestamptz;
