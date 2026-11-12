-- GrowthOS V2: additive multi-product package and banner-variation foundation.
-- No existing pages, prices, assets, publication pointers or analytics are modified.
-- Marketing UI/renderer activation is deliberately deferred until fully tested.

CREATE UNIQUE INDEX IF NOT EXISTS landing_pages_id_brand_uidx
  ON landing_pages (id, brand_id);

CREATE TABLE product_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  package_code text NOT NULL CHECK (package_code ~ '^[a-z0-9]([a-z0-9_-]{0,62}[a-z0-9])?$'),
  offer_version_id uuid NOT NULL REFERENCES offer_versions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX product_packages_brand_code_uidx ON product_packages (brand_id, package_code);
CREATE INDEX product_packages_brand_status_idx ON product_packages (brand_id, status);

CREATE TABLE landing_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  page_id uuid NOT NULL,
  parameter_key text NOT NULL CHECK (parameter_key ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT landing_variations_page_brand_fk FOREIGN KEY (page_id, brand_id)
    REFERENCES landing_pages(id, brand_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX landing_variations_page_parameter_uidx ON landing_variations (page_id, parameter_key);
CREATE INDEX landing_variations_brand_status_idx ON landing_variations (brand_id, status);

CREATE TABLE landing_variation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_id uuid NOT NULL REFERENCES landing_variations(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  banner_asset_id uuid REFERENCES assets(id) ON DELETE RESTRICT,
  copy_overrides jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(copy_overrides) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX landing_variation_versions_number_uidx ON landing_variation_versions (variation_id, version_number);
CREATE UNIQUE INDEX landing_variation_versions_ownership_uidx ON landing_variation_versions (variation_id, id);

CREATE TABLE landing_variation_publications (
  variation_id uuid PRIMARY KEY REFERENCES landing_variations(id) ON DELETE CASCADE,
  version_id uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT landing_variation_publications_version_ownership_fk
    FOREIGN KEY (variation_id, version_id)
    REFERENCES landing_variation_versions(variation_id, id) ON DELETE RESTRICT
);
