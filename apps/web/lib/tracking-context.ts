import { getDatabase } from "@growth-os/db";

export type VerifiedTrackingContext = {
  brandId: string;
  campaignId: string | null;
  pageId: string;
  versionId: string;
  variantId: string | null;
};

type ContextRow = {
  brand_id: string;
  campaign_id: string | null;
  page_id: string;
  version_id: string;
};

export async function verifyTrackingContext(input: { brandId: string; campaignId?: string | null; pageId: string; versionId: string; variantId?: string | null }): Promise<VerifiedTrackingContext | null> {
  const { client } = getDatabase();
  try {
    const [row] = await client<ContextRow[]>`
      SELECT lp.brand_id::text AS brand_id, lp.campaign_id::text AS campaign_id, lp.id::text AS page_id, pv.id::text AS version_id
      FROM landing_pages lp
      JOIN page_versions pv ON pv.page_id=lp.id
      WHERE lp.id=${input.pageId}::uuid AND pv.id=${input.versionId}::uuid
      LIMIT 1`;
    if (!row || row.brand_id !== input.brandId) return null;
    if (input.campaignId != null && input.campaignId !== row.campaign_id) return null;

    if (input.variantId) {
      const [variant] = await client<{ id: string }[]>`
        SELECT v.id::text AS id
        FROM variants v
        JOIN experiments e ON e.id=v.experiment_id
        WHERE v.id=${input.variantId}::uuid
          AND e.page_id=${input.pageId}::uuid
          AND v.page_version_id=${input.versionId}::uuid
        LIMIT 1`;
      if (!variant) return null;
    }

    return {
      brandId: row.brand_id,
      campaignId: row.campaign_id,
      pageId: row.page_id,
      versionId: row.version_id,
      variantId: input.variantId ?? null
    };
  } finally {
    await client.end();
  }
}
