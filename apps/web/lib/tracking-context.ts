import { getDatabase } from "@growth-os/db";

/**
 * Product-owned tracking identity. The browser and downstream product backend
 * may propose identifiers, but only database relations determine attribution.
 */
export type VerifiedTrackingContext = {
  brandId: string;
  campaignId: string | null;
  pageId: string;
  versionId: string;
  variantId: string | null;
  variationId: string | null;
  packageId: string | null;
  packageCode: string | null;
};

type ContextRow = {
  brand_id: string;
  campaign_id: string | null;
  page_id: string;
  version_id: string;
};

type Input = {
  brandId: string;
  campaignId?: string | null;
  pageId: string;
  versionId: string;
  variantId?: string | null;
  properties?: Record<string, unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PACKAGE_CODE = /^[a-z0-9]([a-z0-9_-]{0,62}[a-z0-9])?$/;

function optionalUuid(properties: Record<string, unknown>, key: string) {
  const raw = properties[key];
  if (raw == null) return { valid: true as const, value: null };
  if (typeof raw !== "string" || !UUID.test(raw)) return { valid: false as const, value: null };
  return { valid: true as const, value: raw.toLowerCase() };
}

export async function verifyTrackingContext(input: Input): Promise<VerifiedTrackingContext | null> {
  const properties = input.properties ?? {};
  const variationId = optionalUuid(properties, "variationId");
  const packageId = optionalUuid(properties, "packageId");
  if (!variationId.valid || !packageId.valid) return null;
  const rawPackageCode = properties.packageCode;
  let packageCode: string | null = null;
  if (rawPackageCode != null) {
    if (typeof rawPackageCode !== "string" || !PACKAGE_CODE.test(rawPackageCode)) return null;
    packageCode = rawPackageCode;
  }
  if (properties.variationVersionId != null && !variationId.value) return null;
  const variationVersionId = optionalUuid(properties, "variationVersionId");
  if (!variationVersionId.valid) return null;
  if (variationId.value && input.variantId) return null;

  const { client } = getDatabase();
  try {
    const [page] = await client<ContextRow[]>`
      SELECT lp.brand_id::text AS brand_id, lp.campaign_id::text AS campaign_id,
             lp.id::text AS page_id, pv.id::text AS version_id
      FROM landing_pages lp
      JOIN page_versions pv ON pv.page_id = lp.id
      WHERE lp.id = ${input.pageId}::uuid AND pv.id = ${input.versionId}::uuid
      LIMIT 1
    `;
    if (!page || page.brand_id !== input.brandId) return null;

    let expectedCampaign = page.campaign_id;
    if (variationId.value) {
      const [variation] = await client<{ id: string; campaign_id: string | null }[]>`
        SELECT lv.id::text AS id, lv.campaign_id::text AS campaign_id
        FROM landing_variations lv
        WHERE lv.id = ${variationId.value}::uuid
          AND lv.brand_id = ${page.brand_id}::uuid
          AND lv.page_id = ${page.page_id}::uuid
        LIMIT 1
      `;
      if (!variation) return null;
      expectedCampaign = variation.campaign_id ?? page.campaign_id;
      if (variationVersionId.value) {
        const [version] = await client<{ id: string }[]>`
          SELECT id::text AS id FROM landing_variation_versions
          WHERE variation_id = ${variationId.value}::uuid
            AND id = ${variationVersionId.value}::uuid
          LIMIT 1
        `;
        if (!version) return null;
      }
    }

    if (input.variantId) {
      const [variant] = await client<{ id: string; campaign_id: string | null }[]>`
        SELECT v.id::text AS id, e.campaign_id::text AS campaign_id
        FROM variants v JOIN experiments e ON e.id = v.experiment_id
        WHERE v.id = ${input.variantId}::uuid
          AND e.page_id = ${page.page_id}::uuid
          AND v.page_version_id = ${page.version_id}::uuid
        LIMIT 1
      `;
      if (!variant) return null;
      expectedCampaign = variant.campaign_id ?? page.campaign_id;
    }
    if (input.campaignId != null && input.campaignId !== expectedCampaign) return null;

    let validatedPackageId: string | null = null;
    let validatedPackageCode: string | null = null;
    if (packageId.value || packageCode) {
      const [pkg] = await client<{ id: string; package_code: string }[]>`
        SELECT id::text AS id, package_code
        FROM product_packages
        WHERE brand_id = ${page.brand_id}::uuid
          AND (${packageId.value}::uuid IS NULL OR id = ${packageId.value}::uuid)
          AND (${packageCode}::text IS NULL OR package_code = ${packageCode}::text)
        LIMIT 1
      `;
      if (!pkg) return null;
      validatedPackageId = pkg.id;
      validatedPackageCode = pkg.package_code;
    }

    return {
      brandId: page.brand_id,
      campaignId: expectedCampaign,
      pageId: page.page_id,
      versionId: page.version_id,
      variantId: input.variantId ?? null,
      variationId: variationId.value,
      packageId: validatedPackageId,
      packageCode: validatedPackageCode
    };
  } finally {
    await client.end();
  }
}
