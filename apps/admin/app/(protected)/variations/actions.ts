"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  assets, brands, campaigns, getDatabase, landingPages, landingVariations,
  landingVariationVersions, landingVariationPublications, pagePublications
} from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { writeAudit } from "@/lib/audit";

const KEY = /^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/;
const input = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const copy = (form: FormData) => ({
  headline: input(form, "headline").slice(0, 180),
  subheadline: input(form, "subheadline").slice(0, 500)
});
const asJson = (value: Record<string, unknown>) => value;

async function checkBanner(db: ReturnType<typeof getDatabase>["db"], assetId: string | null, brandId: string) {
  if (!assetId) return;
  const [row] = await db.select({ brandId: assets.brandId, type: assets.type })
    .from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!row || row.brandId !== brandId || !["image", "gif", "svg"].includes(row.type)) throw new Error("INVALID_OR_CROSS_PRODUCT_BANNER");
}

export async function createLandingVariation(form: FormData) {
  const actor = await requirePermission("pages:manage");
  const pageId = input(form, "pageId");
  const key = input(form, "parameterKey").toLowerCase();
  const assetId = input(form, "bannerAssetId") || null;
  const campaignId = input(form, "campaignId") || null;
  const overrides = copy(form);
  if (!KEY.test(key) || !pageId) throw new Error("INVALID_VARIATION_KEY");
  const { db, client } = getDatabase();
  let id = "";
  try {
    await db.transaction(async (tx) => {
      const [page] = await tx.select({
        id: landingPages.id, brandId: landingPages.brandId, status: landingPages.status, brandStatus: brands.status
      }).from(landingPages).innerJoin(brands, eq(brands.id, landingPages.brandId))
        .where(eq(landingPages.id, pageId)).limit(1);
      if (!page || page.status === "archived" || page.brandStatus !== "active") throw new Error("INVALID_VARIATION_PAGE");
      if (campaignId) {
        const [campaign] = await tx.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.brandId, page.brandId))).limit(1);
        if (!campaign) throw new Error("CROSS_PRODUCT_CAMPAIGN");
      }
      await checkBanner(tx as unknown as typeof db, assetId, page.brandId);
      const [variation] = await tx.insert(landingVariations).values({
        pageId, brandId: page.brandId, campaignId, parameterKey: key, createdBy: actor.id, status: "draft"
      }).returning({ id: landingVariations.id });
      if (!variation) throw new Error("VARIATION_CREATE_FAILED");
      id = variation.id;
      await tx.insert(landingVariationVersions).values({
        variationId: id, versionNumber: 1, bannerAssetId: assetId, copyOverrides: asJson(overrides), createdBy: actor.id
      });
    });
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "variation.created", entityType: "landing_variation", entityId: id,
    after: { pageId, parameterKey: key, campaignId, hasBanner: Boolean(assetId), status: "draft" } });
  revalidatePath("/variations");
}

export async function saveVariationDraft(form: FormData) {
  const actor = await requirePermission("pages:manage");
  const id = input(form, "id");
  const assetId = input(form, "bannerAssetId") || null;
  const expected = Number(input(form, "expectedVersion"));
  if (!id || !Number.isSafeInteger(expected) || expected < 1) throw new Error("INVALID_VARIATION_VERSION");
  const { db, client } = getDatabase();
  let version = expected;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
      const [variation] = await tx.select({ brandId: landingVariations.brandId, status: landingVariations.status })
        .from(landingVariations).where(eq(landingVariations.id, id)).limit(1);
      if (!variation || variation.status === "archived") throw new Error("VARIATION_NOT_EDITABLE");
      const [latest] = await tx.select({ version: landingVariationVersions.versionNumber })
        .from(landingVariationVersions).where(eq(landingVariationVersions.variationId, id))
        .orderBy(desc(landingVariationVersions.versionNumber)).limit(1);
      if (!latest || latest.version !== expected) throw new Error("VARIATION_EDIT_CONFLICT_RELOAD");
      await checkBanner(tx as unknown as typeof db, assetId, variation.brandId);
      version = expected + 1;
      await tx.insert(landingVariationVersions).values({
        variationId: id, versionNumber: version, bannerAssetId: assetId,
        copyOverrides: asJson(copy(form)), createdBy: actor.id
      });
    });
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "variation.draft_saved", entityType: "landing_variation", entityId: id,
    after: { version, hasBanner: Boolean(assetId) } });
  revalidatePath("/variations");
}

export async function publishLandingVariation(form: FormData) {
  const actor = await requirePermission("pages:manage");
  const id = input(form, "id");
  const expected = Number(input(form, "expectedVersion"));
  if (!id || !Number.isSafeInteger(expected) || expected < 1) throw new Error("INVALID_VARIATION_VERSION");
  const { db, client } = getDatabase();
  let publishedVersionId = "";
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
      const [row] = await tx.select({
        pageId: landingVariations.pageId, brandId: landingVariations.brandId,
        status: landingVariations.status
      }).from(landingVariations).where(eq(landingVariations.id, id)).limit(1);
      if (!row || row.status === "archived") throw new Error("VARIATION_NOT_PUBLISHABLE");
      const [publication] = await tx.select({ pageId: pagePublications.pageId }).from(pagePublications).where(eq(pagePublications.pageId, row.pageId)).limit(1);
      if (!publication) throw new Error("PUBLISH_PARENT_LANDING_PAGE_FIRST");
      const [latest] = await tx.select({
        id: landingVariationVersions.id, version: landingVariationVersions.versionNumber,
        bannerAssetId: landingVariationVersions.bannerAssetId
      }).from(landingVariationVersions).where(eq(landingVariationVersions.variationId, id))
        .orderBy(desc(landingVariationVersions.versionNumber)).limit(1);
      if (!latest || latest.version !== expected) throw new Error("VARIATION_PUBLISH_CONFLICT_RELOAD");
      await checkBanner(tx as unknown as typeof db, latest.bannerAssetId, row.brandId);
      publishedVersionId = latest.id;
      await tx.insert(landingVariationPublications).values({ variationId: id, versionId: latest.id, publishedBy: actor.id })
        .onConflictDoUpdate({ target: landingVariationPublications.variationId,
          set: { versionId: latest.id, publishedBy: actor.id, publishedAt: new Date() } });
      await tx.update(landingVariations).set({ status: "active", updatedAt: new Date() }).where(eq(landingVariations.id, id));
    });
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "variation.published", entityType: "landing_variation", entityId: id,
    after: { versionId: publishedVersionId } });
  revalidatePath("/variations");
}

export async function pauseLandingVariation(form: FormData) {
  const actor = await requirePermission("pages:manage");
  const id = input(form, "id");
  const { db, client } = getDatabase();
  try {
    const [row] = await db.update(landingVariations).set({ status: "paused", updatedAt: new Date() })
      .where(and(eq(landingVariations.id, id), eq(landingVariations.status, "active")))
      .returning({ id: landingVariations.id });
    if (!row) throw new Error("ACTIVE_VARIATION_NOT_FOUND");
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "variation.paused", entityType: "landing_variation", entityId: id });
  revalidatePath("/variations");
}

export async function rollbackLandingVariation(form: FormData) {
  const actor = await requirePermission("pages:manage");
  const id = input(form, "id");
  const targetVersion = input(form, "versionId");
  const expectedPublication = input(form, "expectedPublishedVersionId");
  const { db, client } = getDatabase();
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
      const [variation] = await tx.select({ brandId: landingVariations.brandId }).from(landingVariations).where(eq(landingVariations.id, id)).limit(1);
      if (!variation) throw new Error("VARIATION_NOT_FOUND");
      const [currently] = await tx.select({ versionId: landingVariationPublications.versionId })
        .from(landingVariationPublications).where(eq(landingVariationPublications.variationId, id)).limit(1);
      if (!currently || currently.versionId !== expectedPublication) throw new Error("VARIATION_ROLLBACK_CONFLICT_RELOAD");
      const [version] = await tx.select({ id: landingVariationVersions.id, bannerAssetId: landingVariationVersions.bannerAssetId })
        .from(landingVariationVersions).where(and(eq(landingVariationVersions.variationId, id), eq(landingVariationVersions.id, targetVersion))).limit(1);
      if (!version) throw new Error("VARIATION_VERSION_NOT_FOUND");
      await checkBanner(tx as unknown as typeof db, version.bannerAssetId, variation.brandId);
      await tx.update(landingVariationPublications).set({ versionId: targetVersion, publishedAt: new Date(), publishedBy: actor.id })
        .where(eq(landingVariationPublications.variationId, id));
      await tx.update(landingVariations).set({ status: "active", updatedAt: new Date() }).where(eq(landingVariations.id, id));
    });
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "variation.rolled_back", entityType: "landing_variation", entityId: id,
    before: { versionId: expectedPublication }, after: { versionId: targetVersion } });
  revalidatePath("/variations");
}
