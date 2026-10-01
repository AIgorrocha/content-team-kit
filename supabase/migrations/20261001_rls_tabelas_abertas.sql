-- Protecao por linha (RLS) nas tabelas que ficaram abertas para a chave publica (anon).
-- Achado na revisao de seguranca de 01/10/2026: sem RLS, ou com politica "liberada para todos",
-- qualquer um com a chave publica do Supabase lia, alterava e apagava essas tabelas pela API REST.
-- Os scripts do time usam a chave de servico (service_role) ou conexao direta, que nao sao
-- afetadas pela RLS. Sem politica nova: so o servidor acessa.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ct_metrics_snapshots','ct_saved_inspiration','ct_social_insights',
                           'ct_drive_assets','ct_agent_skills','ct_research_posts','ct_research_runs']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS ct_research_posts_all ON public.ct_research_posts;
DROP POLICY IF EXISTS ct_research_runs_all ON public.ct_research_runs;
