import { and, eq, inArray } from "drizzle-orm";
import { assetUsages, assets, getDatabase } from "@growth-os/db";
import type { PageDocument } from "@growth-os/page-engine";
import { collectAssetReferences } from "./asset-references";

export async function validatePageAssetReferences(brandId: string, document: PageDocument) {
  const references = collectAssetReferences(document);
  const ids = [...new Set(references.map((reference) => reference.assetId))];
  if (!ids.length) return { ok: true as const };
  const { db, client } = getDatabase();
  try {
    const rows = await db.select({ id: assets.id, brandId: assets.brandId }).from(assets).where(inArray(assets.id, ids));
    const byId = new Map(rows.map((asset) => [asset.id, asset]));
    const invalid = ids.filter((id) => !byId.has(id) || byId.get(id)?.brandId !== brandId);
    if (invalid.length) return { ok: false as const, invalid };
    return { ok: true as const };
  } finally { await client.end(); }
}

export async function syncDraftAssetUsages(pageId: string, document: PageDocument) {
  const references = collectAssetReferences(document);
  const { db, client } = getDatabase();
  try {
    await db.delete(assetUsages).where(and(eq(assetUsages.entityType, "landing_page_draft"), eq(assetUsages.entityId, pageId)));
    if (references.length) {
      await db.insert(assetUsages).values(references.map((reference) => ({
        assetId: reference.assetId,
        entityType: "landing_page_draft",
        entityId: pageId,
        fieldPath: reference.fieldPath
      }))).onConflictDoNothing();
    }
  } finally { await client.end(); }
}
