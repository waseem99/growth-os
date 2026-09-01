ALTER TABLE landing_pages
  ADD COLUMN IF NOT EXISTS draft_seo jsonb NOT NULL DEFAULT '{}'::jsonb;
