CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('owner','admin','editor','analyst'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active','disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE brand_status AS ENUM ('active','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE domain_status AS ENUM ('pending','verified','disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE campaign_status AS ENUM ('draft','active','paused','completed','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE page_status AS ENUM ('draft','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_type AS ENUM ('image','video','gif','svg'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE experiment_status AS ENUM ('draft','running','paused','ended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ai_job_status AS ENUM ('queued','running','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  role user_role NOT NULL DEFAULT 'analyst',
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status brand_status NOT NULL DEFAULT 'active',
  logo_asset_id uuid,
  favicon_asset_id uuid,
  default_social_asset_id uuid,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL
);
CREATE INDEX brands_status_idx ON brands(status);

CREATE TABLE domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  hostname text NOT NULL UNIQUE,
  status domain_status NOT NULL DEFAULT 'pending',
  is_primary boolean NOT NULL DEFAULT false,
  verification_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX domains_brand_idx ON domains(brand_id);
CREATE INDEX domains_status_idx ON domains(status);
CREATE UNIQUE INDEX domains_one_primary_per_brand_uidx ON domains(brand_id) WHERE is_primary = true AND status <> 'disabled';

CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, slug)
);
CREATE INDEX offers_brand_idx ON offers(brand_id);

CREATE TABLE offer_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  currency text NOT NULL DEFAULT 'PKR',
  initial_amount numeric(12,2) CHECK (initial_amount IS NULL OR initial_amount >= 0),
  recurring_amount numeric(12,2) CHECK (recurring_amount IS NULL OR recurring_amount >= 0),
  billing_interval text,
  trial_days integer CHECK (trial_days IS NULL OR trial_days >= 0),
  auto_renew boolean NOT NULL DEFAULT false,
  benefit jsonb NOT NULL DEFAULT '{}'::jsonb,
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  UNIQUE (offer_id, version_number)
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  offer_version_id uuid REFERENCES offer_versions(id) ON DELETE SET NULL,
  name text NOT NULL,
  platform text NOT NULL,
  objective text NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  utm_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX campaigns_brand_status_idx ON campaigns(brand_id, status);
CREATE INDEX campaigns_platform_idx ON campaigns(platform);

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX templates_scope_slug_uidx ON templates(COALESCE(brand_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

CREATE TABLE landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES domains(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  status page_status NOT NULL DEFAULT 'draft',
  conversion_goal text,
  draft_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_revision integer NOT NULL DEFAULT 1 CHECK (draft_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  UNIQUE (brand_id, slug)
);
CREATE INDEX landing_pages_campaign_idx ON landing_pages(campaign_id);
CREATE INDEX landing_pages_domain_idx ON landing_pages(domain_id);
CREATE INDEX landing_pages_updated_idx ON landing_pages(updated_at DESC);

CREATE TABLE page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  offer_version_id uuid REFERENCES offer_versions(id) ON DELETE SET NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  content jsonb NOT NULL,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  publish_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  UNIQUE (page_id, version_number),
  UNIQUE (id, page_id)
);
CREATE INDEX page_versions_page_created_idx ON page_versions(page_id, created_at DESC);

CREATE TABLE page_publications (
  page_id uuid PRIMARY KEY REFERENCES landing_pages(id) ON DELETE CASCADE,
  version_id uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT page_publications_version_belongs_to_page_fk
    FOREIGN KEY (version_id, page_id) REFERENCES page_versions(id, page_id) ON DELETE RESTRICT
);

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type asset_type NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  title text,
  alt_text text,
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL
);
CREATE INDEX assets_brand_type_idx ON assets(brand_id, type);

ALTER TABLE brands ADD CONSTRAINT brands_logo_asset_fk FOREIGN KEY (logo_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE brands ADD CONSTRAINT brands_favicon_asset_fk FOREIGN KEY (favicon_asset_id) REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE brands ADD CONSTRAINT brands_social_asset_fk FOREIGN KEY (default_social_asset_id) REFERENCES assets(id) ON DELETE SET NULL;

CREATE TABLE asset_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, entity_type, entity_id, field_path)
);
CREATE INDEX asset_usages_entity_idx ON asset_usages(entity_type, entity_id);

CREATE TABLE experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  name text NOT NULL,
  status experiment_status NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX experiments_page_status_idx ON experiments(page_id, status);

CREATE TABLE variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  page_version_id uuid NOT NULL REFERENCES page_versions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  allocation integer NOT NULL CHECK (allocation >= 0 AND allocation <= 100),
  is_control boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX variants_experiment_idx ON variants(experiment_id);
CREATE UNIQUE INDEX variants_one_control_uidx ON variants(experiment_id) WHERE is_control = true;

CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  page_id uuid REFERENCES landing_pages(id) ON DELETE SET NULL,
  version_id uuid REFERENCES page_versions(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES variants(id) ON DELETE SET NULL,
  creative_id text,
  session_id text,
  anonymous_id text,
  user_id text,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_occurred_idx ON analytics_events(occurred_at DESC);
CREATE INDEX analytics_events_page_occurred_idx ON analytics_events(page_id, occurred_at DESC);
CREATE INDEX analytics_events_campaign_occurred_idx ON analytics_events(campaign_id, occurred_at DESC);

CREATE TABLE conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  page_id uuid REFERENCES landing_pages(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES variants(id) ON DELETE SET NULL,
  session_id text,
  value numeric(14,2) CHECK (value IS NULL OR value >= 0),
  currency text,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversions_occurred_idx ON conversions(occurred_at DESC);
CREATE INDEX conversions_campaign_occurred_idx ON conversions(campaign_id, occurred_at DESC);

CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disabled',
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, provider)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before jsonb,
  after jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);

CREATE TABLE ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  action text NOT NULL,
  provider text,
  model text,
  status ai_job_status NOT NULL DEFAULT 'queued',
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ai_jobs_status_created_idx ON ai_jobs(status, created_at DESC);
