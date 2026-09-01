import { and, eq } from "drizzle-orm";
import { getDatabase, landingPages, pageVersions } from "@growth-os/db";

export type VerifiedTrackingContext = {
  brandId: string;
  campaignId: string | null;
  pageId: string;
  versionId: string;
};

export async function verifyTrackingContext(input: { brandId: string; campaignId?: string | null; pageId: string; versionId: string }): Promise<VerifiedTrackingContext | null> {
  const { db, client } = getDatabase();
  try {
    const [row] = await db.select({
      brandId: landingPages.brandId,
      campaignId: landingPages.campaignId,
      pageId: landingPages.id,
      versionId: pageVersions.id
    }).from(landingPages)
      .innerJoin(pageVersions, eq(pageVersions.pageId, landingPages.id))
      .where(and(eq(landingPages.id, input.pageId), eq(pageVersions.id, input.versionId)))
      .limit(1);
    if (!row || row.brandId !== input.brandId) return null;
    if (input.campaignId != null && input.campaignId !== row.campaignId) return null;
    return row;
  } finally {
    await client.end();
  }
}
