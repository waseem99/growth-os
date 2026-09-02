"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { del, head } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { assetUsages, assets, brands, campaigns, getDatabase, landingPages } from "@growth-os/db";
import { pageDocumentSchema } from "@growth-os/page-engine";
import { requirePermission } from "@/lib/user-access";
import { assetTypeFromMime, collectAssetReferences, normalizeTags, replaceAssetReference } from "@/lib/asset-references";

const metadata = (value: Record<string, unknown>) => value;

type RegisterAssetInput = {
  blobUrl: string;
  brandId: string;
  campaignId?: string | null;
  originalName: string;
  mimeType: string;
  fileSize: number;
  title?: string;
  altText?: string;
  tags?: string;
  platform?: string;
  creativeId?: string;
  adHeadline?: string;
  adPrimaryText?: string;
  adCta?: string;
  width?: number | null;
  height?: number | null;
};

async function assertBrandCampaign(brandId: string, campaignId?: string | null) {
  const { db, client } = getDatabase();
  try {
    const [brand] = await db.select({ id: brands.id, status: brands.status }).from(brands).where(eq(brands.id, brandId)).limit(1);
    if (!brand || brand.status !== "active") throw new Error("BRAND_NOT_ACTIVE");
    if (campaignId) {
      const [campaign] = await db.select({ brandId: campaigns.brandId }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
      if (!campaign || campaign.brandId !== brandId) throw new Error("CAMPAIGN_BRAND_MISMATCH");
    }
  } finally { await client.end(); }
}

export async function registerAsset(input: RegisterAssetInput) {
  const actor = await requirePermission("assets:manage");
  await assertBrandCampaign(input.brandId, input.campaignId || null);
  const blob = await head(input.blobUrl);
  const type = assetTypeFromMime(blob.contentType || input.mimeType);
  if (!type) throw new Error("UNSUPPORTED_ASSET");
  if (blob.size !== input.fileSize) throw new Error("ASSET_SIZE_MISMATCH");
  const { db, client } = getDatabase();
  try {
    const [created] = await db.insert(assets).values({
      brandId: input.brandId,
      type,
      storageKey: blob.url,
      mimeType: blob.contentType || input.mimeType,
      title: (input.title || input.originalName).trim().slice(0, 180),
      altText: (input.altText || "").trim().slice(0, 300) || null,
      width: input.width && input.width > 0 ? Math.round(input.width) : null,
      height: input.height && input.height > 0 ? Math.round(input.height) : null,
      fileSize: blob.size,
      metadata: metadata({
        pathname: blob.pathname,
        originalName: input.originalName.slice(0, 255),
        tags: normalizeTags(input.tags || ""),
        campaignId: input.campaignId || null,
        platform: (input.platform || "").trim().slice(0, 80) || null,
        creativeId: (input.creativeId || "").trim().slice(0, 120) || null,
        adHeadline: (input.adHeadline || "").trim().slice(0, 240) || null,
        adPrimaryText: (input.adPrimaryText || "").trim().slice(0, 700) || null,
        adCta: (input.adCta || "").trim().slice(0, 80) || null,
        uploadedBy: actor.id
      }),
      createdBy: actor.id
    }).returning({ id: assets.id });
    if (!created) throw new Error("ASSET_REGISTER_FAILED");
    revalidatePath("/assets");
    revalidatePath("/campaigns");
    return created;
  } finally { await client.end(); }
}

export async function updateAssetMetadata(input: { id: string; title: string; altText: string; tags: string; campaignId?: string | null; platform?: string; creativeId?: string; adHeadline?: string; adPrimaryText?: string; adCta?: string }) {
  await requirePermission("assets:manage");
  const { db, client } = getDatabase();
  try {
    const [asset] = await db.select({ id: assets.id, brandId: assets.brandId, metadata: assets.metadata }).from(assets).where(eq(assets.id, input.id)).limit(1);
    if (!asset) throw new Error("ASSET_NOT_FOUND");
    await assertBrandCampaign(asset.brandId, input.campaignId || null);
    const current = asset.metadata && typeof asset.metadata === "object" ? asset.metadata : {};
    await db.update(assets).set({
      title: input.title.trim().slice(0, 180) || null,
      altText: input.altText.trim().slice(0, 300) || null,
      metadata: metadata({
        ...current,
        tags: normalizeTags(input.tags),
        campaignId: input.campaignId || null,
        platform: input.platform?.trim().slice(0, 80) || null,
        creativeId: input.creativeId?.trim().slice(0, 120) || null,
        adHeadline: input.adHeadline?.trim().slice(0, 240) || null,
        adPrimaryText: input.adPrimaryText?.trim().slice(0, 700) || null,
        adCta: input.adCta?.trim().slice(0, 80) || null
      })
    }).where(eq(assets.id, input.id));
  } finally { await client.end(); }
  revalidatePath("/assets");
  revalidatePath(`/assets/${input.id}`);
  revalidatePath("/campaigns");
}

export async function deleteAsset(formData: FormData) {
  await requirePermission("assets:manage");
  const id = String(formData.get("id") ?? "");
  const { db, client } = getDatabase();
  let url = "";
  try {
    const [asset] = await db.select({ storageKey: assets.storageKey }).from(assets).where(eq(assets.id, id)).limit(1);
    if (!asset) return;
    const [usage] = await db.select({ id: assetUsages.id }).from(assetUsages).where(eq(assetUsages.assetId, id)).limit(1);
    const [brandUsage] = await db.select({ id: brands.id }).from(brands).where(or(eq(brands.logoAssetId, id), eq(brands.faviconAssetId, id), eq(brands.defaultSocialAssetId, id))).limit(1);
    if (usage || brandUsage) throw new Error("ASSET_IS_REFERENCED");
    await db.delete(assets).where(eq(assets.id, id));
    url = asset.storageKey;
  } finally { await client.end(); }
  if (url) await del(url);
  revalidatePath("/assets");
  revalidatePath("/campaigns");
}

export async function replaceAssetInDrafts(input: { oldAssetId: string; newAssetId: string; pageIds: string[] }) {
  const actor = await requirePermission("assets:manage");
  const pageIds = [...new Set(input.pageIds)].slice(0, 100);
  if (!pageIds.length || input.oldAssetId === input.newAssetId) return { updated: 0 };
  const { db, client } = getDatabase();
  try {
    const assetRows = await db.select({ id: assets.id, brandId: assets.brandId }).from(assets).where(inArray(assets.id, [input.oldAssetId, input.newAssetId]));
    const oldAsset = assetRows.find((asset) => asset.id === input.oldAssetId);
    const nextAsset = assetRows.find((asset) => asset.id === input.newAssetId);
    if (!oldAsset || !nextAsset || oldAsset.brandId !== nextAsset.brandId) throw new Error("REPLACEMENT_ASSET_BRAND_MISMATCH");
    const pages = await db.select({ id: landingPages.id, brandId: landingPages.brandId, content: landingPages.draftContent, revision: landingPages.draftRevision }).from(landingPages)
      .where(and(inArray(landingPages.id, pageIds), eq(landingPages.status, "draft")));
    let updated = 0;
    for (const page of pages) {
      if (page.brandId !== oldAsset.brandId) continue;
      const parsed = pageDocumentSchema.safeParse(page.content);
      if (!parsed.success || !collectAssetReferences(parsed.data).some((reference) => reference.assetId === input.oldAssetId)) continue;
      const document = replaceAssetReference(parsed.data, input.oldAssetId, input.newAssetId);
      await db.update(landingPages).set({ draftContent: document as unknown as Record<string, unknown>, draftRevision: page.revision + 1, updatedAt: new Date(), updatedBy: actor.id }).where(eq(landingPages.id, page.id));
      await db.delete(assetUsages).where(and(eq(assetUsages.entityType, "landing_page_draft"), eq(assetUsages.entityId, page.id)));
      const references = collectAssetReferences(document);
      if (references.length) await db.insert(assetUsages).values(references.map((reference) => ({ assetId: reference.assetId, entityType: "landing_page_draft", entityId: page.id, fieldPath: reference.fieldPath }))).onConflictDoNothing();
      updated += 1;
    }
    return { updated };
  } finally {
    await client.end();
    revalidatePath("/assets");
    revalidatePath("/pages");
  }
}
