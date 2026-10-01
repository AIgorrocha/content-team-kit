-- Migration: ct_video_projects
-- Tabela para projetos de video do Studio (Remotion)
-- Referenciada por: src/app/api/studio/route.ts, [id]/route.ts, render/route.ts

CREATE TABLE IF NOT EXISTS ct_video_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'draft',
  composition_data JSONB,
  duration_seconds INTEGER NOT NULL DEFAULT 30,
  fps             INTEGER NOT NULL DEFAULT 30,
  width           INTEGER NOT NULL DEFAULT 1080,
  height          INTEGER NOT NULL DEFAULT 1920,
  source_media_ids UUID[] DEFAULT '{}',
  caption_srt     TEXT,
  caption_style   JSONB,
  output_url      TEXT,
  output_formats  TEXT[] DEFAULT '{}',
  render_id       VARCHAR(255),
  render_progress REAL DEFAULT 0,
  client_slug     VARCHAR(50) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ct_video_projects_status ON ct_video_projects(status);
CREATE INDEX idx_ct_video_projects_client_slug ON ct_video_projects(client_slug);
CREATE INDEX idx_ct_video_projects_updated_at ON ct_video_projects(updated_at DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION ct_video_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ct_video_projects_updated_at
  BEFORE UPDATE ON ct_video_projects
  FOR EACH ROW
  EXECUTE FUNCTION ct_video_projects_updated_at();
