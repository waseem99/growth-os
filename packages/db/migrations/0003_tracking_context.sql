ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS medium text;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS campaign_name text;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS term text;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS content text;

CREATE INDEX IF NOT EXISTS analytics_events_variant_occurred_idx ON analytics_events(variant_id, occurred_at DESC);
