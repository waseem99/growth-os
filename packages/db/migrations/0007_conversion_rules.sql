-- GrowthOS V2: enforce product ownership of offers/assets and add configurable
-- provider-specific conversion event rules. Additive and empty by default.
-- Requires 0006_dynamic_campaigns.

CREATE UNIQUE INDEX product_packages_id_brand_uidx ON product_packages (id, brand_id);

CREATE TABLE conversion_event_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  package_id uuid,
  provider text NOT NULL CHECK (provider IN ('meta', 'tiktok')),
  canonical_event text NOT NULL CHECK (canonical_event IN ('signup_complete', 'subscription_started', 'purchase')),
  provider_event text NOT NULL,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT conversion_rules_package_brand_fk FOREIGN KEY (package_id, brand_id)
    REFERENCES product_packages(id, brand_id) ON DELETE CASCADE,
  CONSTRAINT conversion_rules_provider_event_check CHECK (
    (provider = 'meta' AND provider_event IN ('CompleteRegistration', 'Subscribe', 'Purchase'))
    OR
    (provider = 'tiktok' AND provider_event IN ('CompleteRegistration', 'Subscribe', 'CompletePayment'))
  )
);
CREATE UNIQUE INDEX conversion_event_rules_scope_uidx ON conversion_event_rules
  (brand_id, package_id, provider, canonical_event) NULLS NOT DISTINCT;
CREATE INDEX conversion_event_rules_brand_status_idx ON conversion_event_rules(brand_id, status);

-- Intra-brand integrity cannot be expressed as an ordinary FK from a
-- version to the offer/asset owner, so enforce it when version references change.
CREATE FUNCTION growthos_validate_package_offer_brand() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM offer_versions ov
    JOIN offers o ON o.id = ov.offer_id
    WHERE ov.id = NEW.offer_version_id AND o.brand_id = NEW.brand_id
  ) THEN
    RAISE EXCEPTION 'The package offer version must belong to its product';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER growthos_product_packages_offer_owner
BEFORE INSERT OR UPDATE OF brand_id, offer_version_id ON product_packages
FOR EACH ROW EXECUTE FUNCTION growthos_validate_package_offer_brand();

CREATE FUNCTION growthos_validate_variation_asset_brand() RETURNS trigger AS $$
BEGIN
  IF NEW.banner_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM assets a
    JOIN landing_variations lv ON lv.id = NEW.variation_id
    WHERE a.id = NEW.banner_asset_id AND a.brand_id = lv.brand_id
      AND a.type IN ('image', 'gif', 'svg')
  ) THEN
    RAISE EXCEPTION 'The variation banner must be a visual asset belonging to its product';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER growthos_variation_versions_asset_owner
BEFORE INSERT OR UPDATE OF variation_id, banner_asset_id ON landing_variation_versions
FOR EACH ROW EXECUTE FUNCTION growthos_validate_variation_asset_brand();
