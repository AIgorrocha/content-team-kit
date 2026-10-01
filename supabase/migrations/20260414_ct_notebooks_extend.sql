-- ct_notebooks: estender schema pra guardar notebook_id do NotebookLM + tema + fontes
-- Usado pela skill ct-artigo-linkedin (pipeline de artigos LinkedIn)
-- Tabela ja existia com (id, name, description, client_slug, created_at, updated_at)

ALTER TABLE ct_notebooks
  ADD COLUMN IF NOT EXISTS notebook_id text,
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS notebook_url text,
  ADD COLUMN IF NOT EXISTS sources jsonb,
  ADD COLUMN IF NOT EXISTS content_item_id uuid REFERENCES ct_content_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ct_notebooks_client ON ct_notebooks(client_slug);
CREATE INDEX IF NOT EXISTS idx_ct_notebooks_theme ON ct_notebooks(theme);
