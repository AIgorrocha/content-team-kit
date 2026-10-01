-- ct_research_runs: rodada de pesquisa (Twitter/IG/LinkedIn/TikTok/YouTube)
CREATE TABLE IF NOT EXISTS public.ct_research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  mode text NOT NULL,
  client_slug text,
  label text,
  source_url text,
  keywords text[] DEFAULT '{}',
  source_file text,
  fetched_at timestamptz,
  posts_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_research_runs_key
  ON public.ct_research_runs (platform, mode, COALESCE(client_slug, ''), COALESCE(source_file, ''));
CREATE INDEX IF NOT EXISTS idx_ct_research_runs_platform ON public.ct_research_runs (platform);
CREATE INDEX IF NOT EXISTS idx_ct_research_runs_client ON public.ct_research_runs (client_slug);
CREATE INDEX IF NOT EXISTS idx_ct_research_runs_fetched_at ON public.ct_research_runs (fetched_at DESC);

-- ct_research_posts: posts/videos/tweets capturados
CREATE TABLE IF NOT EXISTS public.ct_research_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ct_research_runs(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_id text,
  author_name text,
  author_handle text,
  url text,
  text text,
  media jsonb DEFAULT '[]'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}',
  external_links text[] DEFAULT '{}',
  raw jsonb,
  posted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_research_posts_external
  ON public.ct_research_posts (run_id, platform, COALESCE(external_id, ''));
CREATE INDEX IF NOT EXISTS idx_ct_research_posts_run ON public.ct_research_posts (run_id);
CREATE INDEX IF NOT EXISTS idx_ct_research_posts_platform ON public.ct_research_posts (platform);
CREATE INDEX IF NOT EXISTS idx_ct_research_posts_posted_at ON public.ct_research_posts (posted_at DESC);

ALTER TABLE public.ct_research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ct_research_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ct_research_runs_all" ON public.ct_research_runs;
CREATE POLICY "ct_research_runs_all" ON public.ct_research_runs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ct_research_posts_all" ON public.ct_research_posts;
CREATE POLICY "ct_research_posts_all" ON public.ct_research_posts FOR ALL USING (true) WITH CHECK (true);
