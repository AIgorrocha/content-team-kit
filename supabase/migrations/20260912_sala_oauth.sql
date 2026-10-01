-- Sala Fase 2 (D2): nonces de state OAuth, consumo atomico via UPDATE.
create table if not exists ct_sala_oauth_states (
  state_hash text primary key,
  client_slug text not null,
  user_id text not null,
  service text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists idx_ct_sala_oauth_states_expires_at
  on ct_sala_oauth_states (expires_at);
