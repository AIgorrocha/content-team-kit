-- Add platform column to ct_competitor_posts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_competitor_posts' AND column_name = 'platform'
  ) THEN
    ALTER TABLE ct_competitor_posts ADD COLUMN platform text DEFAULT 'instagram';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_competitor_posts' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE ct_competitor_posts ADD COLUMN external_id text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_competitor_posts' AND column_name = 'content_preview'
  ) THEN
    ALTER TABLE ct_competitor_posts ADD COLUMN content_preview text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_competitor_posts' AND column_name = 'scraped_at'
  ) THEN
    ALTER TABLE ct_competitor_posts ADD COLUMN scraped_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add media_urls and published_at to ct_content_items if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_content_items' AND column_name = 'media_urls'
  ) THEN
    ALTER TABLE ct_content_items ADD COLUMN media_urls text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_content_items' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE ct_content_items ADD COLUMN published_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_content_items' AND column_name = 'source_url'
  ) THEN
    ALTER TABLE ct_content_items ADD COLUMN source_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_content_items' AND column_name = 'content_body'
  ) THEN
    ALTER TABLE ct_content_items ADD COLUMN content_body text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ct_content_items' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE ct_content_items ADD COLUMN created_by text;
  END IF;
END $$;

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_competitor_posts_platform ON ct_competitor_posts(platform);
CREATE INDEX IF NOT EXISTS idx_competitor_posts_scraped ON ct_competitor_posts(scraped_at);
CREATE INDEX IF NOT EXISTS idx_content_items_status_scheduled ON ct_content_items(status, scheduled_at);
