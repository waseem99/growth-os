import { inArray } from "drizzle-orm";
import { assets, getDatabase } from "@growth-os/db";
import { collectAssetIds, type PageDocument } from "@growth-os/page-engine";

export type PublicAsset = { id: string; url: string; type: "image" | "video" | "gif" | "svg"; altText: string | null; width: number | null; height: number | null; mimeType: string };

export async function resolvePageAssets(document: PageDocument, extraIds: Array<string | null | undefined> = []) {
  const ids = [...new Set([...collectAssetIds(document), ...extraIds.filter((id): id is string => Boolean(id))])];
  if (!ids.length) return new Map<string, PublicAsset>();
  const { db, client } = getDatabase();
  try {
    const rows = await db.select({ id: assets.id, url: assets.storageKey, type: assets.type, altText: assets.altText, width: assets.width, height: assets.height, mimeType: assets.mimeType }).from(assets).where(inArray(assets.id, ids));
    return new Map(rows.map((asset) => [asset.id, asset]));
  } finally { await client.end(); }
}
