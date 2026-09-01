import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { assets, brands, getDatabase, landingPages } from "@growth-os/db";
import { PageRenderer, pageDocumentSchema, type BrandRenderTheme } from "@growth-os/page-engine";
import { collectAssetReferences } from "@/lib/asset-references";
import { requireGrowthUser } from "@/lib/user-access";

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";

export default async function DraftPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGrowthUser();
  const { id } = await params;
  const { db, client } = getDatabase();
  try {
    const [page] = await db.select({ content: landingPages.draftContent, theme: brands.theme }).from(landingPages).innerJoin(brands, eq(landingPages.brandId, brands.id)).where(eq(landingPages.id, id)).limit(1);
    if (!page) notFound();
    const parsed = pageDocumentSchema.safeParse(page.content);
    if (!parsed.success) notFound();
    const ids = [...new Set(collectAssetReferences(parsed.data).map((reference) => reference.assetId))];
    const assetRows = ids.length ? await db.select({ id: assets.id, url: assets.storageKey }).from(assets).where(inArray(assets.id, ids)) : [];
    const assetMap = new Map(assetRows.map((asset) => [asset.id, asset.url]));
    return <div><div className="preview-banner">Secure draft preview · noindex · never served as production</div><PageRenderer document={parsed.data} theme={page.theme as BrandRenderTheme} resolveAsset={(assetId) => assetMap.get(assetId)} /></div>;
  } finally { await client.end(); }
}
