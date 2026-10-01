-- A Sala acessa estas tabelas pelo servidor autenticado e pela conexão privilegiada.
-- Sem políticas públicas: anon/authenticated não recebem acesso direto ao cofre ou clientes.
alter table public.ct_sala_oauth_states enable row level security;
alter table public.ct_credentials enable row level security;
alter table public.ct_connections enable row level security;
alter table public.ct_piece_revisions enable row level security;
alter table public.ct_piece_stages enable row level security;
alter table public.ct_agent_events enable row level security;
alter table public.ct_rules enable row level security;
alter table public.ct_agent_prompts enable row level security;
alter table public.ct_skills enable row level security;
alter table public.ct_sala_migrations enable row level security;
