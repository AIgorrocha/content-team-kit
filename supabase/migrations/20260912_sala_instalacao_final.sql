-- Sala de Comando: tabela usada por src/app/api/instagram/accounts (e rotas de Ads)
-- que faltava nas migrations versionadas. Aditiva e idempotente.

create table if not exists public.ct_instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  ig_user_id text not null,
  access_token text not null,
  ad_account_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_ct_instagram_accounts_handle on public.ct_instagram_accounts (handle);

alter table public.ct_instagram_accounts enable row level security;

-- Sem política pública. Somente o servidor com papel privilegiado acessa os tokens.
