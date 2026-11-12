-- GrowthOS V2: auditable, idempotent conversion provider delivery queue.
-- Creates no jobs on migration. Only authenticated, consent-confirmed callbacks
-- can insert pending delivery records. No external API is called by this migration.
CREATE TABLE conversion_provider_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id uuid NOT NULL REFERENCES conversions(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('meta', 'tiktok')),
  provider_event text NOT NULL,
  provider_event_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'attempting', 'delivered', 'failed', 'suspended')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  delivered_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX conversion_provider_deliveries_once_uidx
  ON conversion_provider_deliveries (conversion_id, provider);
CREATE UNIQUE INDEX conversion_provider_deliveries_event_uidx
  ON conversion_provider_deliveries (provider, provider_event_id);
CREATE INDEX conversion_provider_deliveries_due_idx
  ON conversion_provider_deliveries (status, next_attempt_at);
CREATE INDEX conversion_provider_deliveries_brand_idx
  ON conversion_provider_deliveries (brand_id, created_at DESC);
