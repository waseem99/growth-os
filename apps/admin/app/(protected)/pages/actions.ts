"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDatabase, brands, campaigns, landingPages } from "@growth-os/db";
import { pageDocumentSchema, type PageDocument } from "@growth-os/page-engine";
import { requirePermission } from "@/lib/user-access";
import { instantiatePageTemplate, normalizePageSlug, reseedPageDocument } from "@/lib/page-input";

const json = (value: unknown) => value as Record<string, unknown>;

async function assertBrandAndCampaign(brandId: string, campaignId?: string | null) {
  const { db, client } = getDatabase();
  try {
    const [brand] = await db.select({ id: brands.id, status: brands.status }).from(brands).where(eq(brands.id, brandId)).limit(1);
    if (!brand || brand.status !== "active") throw new Error("BRAND_NOT_ACTIVE");
    if (campaignId) {
      const [campaign] = await db.select({ id: campaigns.id, brandId: campaigns.brandId }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
      if (!campaign || campaign.brandId !== brandId) throw new Error("CAMPAIGN_BRAND_MISMATCH");
    }
  } finally {
    await client.end();
  }
}

export async function createPage(formData: FormData) {
  const actor = await requirePermission("pages:manage");
  const name = String(formData.get("name") ?? "").trim().slice(0, 160);
  const brandId = String(formData.get("brandId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "") || null;
  const templateKey = String(formData.get("templateKey") ?? "minimal");
  const slug = normalizePageSlug(String(formData.get("slug") ?? name));
  if (!name || !slug || !brandId) throw new Error("PAGE_INPUT_REQUIRED");
  await assertBrandAndCampaign(brandId, campaignId);
  const document = instantiatePageTemplate(templateKey);
  const { db, client } = getDatabase();
  let id = "";
  try {
    const [created] = await db.insert(landingPages).values({
      brandId,
      campaignId,
      name,
      slug,
      conversionGoal: "subscription",
      draftContent: json(document),
      createdBy: actor.id,
      updatedBy: actor.id
    }).returning({ id: landingPages.id });
    if (!created) throw new Error("PAGE_CREATE_FAILED");
    id = created.id;
  } finally {
    await client.end();
  }
  redirect(`/pages/${id}`);
}

export type SavePageDraftInput = {
  id: string;
  expectedRevision: number;
  name: string;
  slug: string;
  brandId: string;
  campaignId: string | null;
  conversionGoal: string;
  document: unknown;
};

export type SavePageDraftResult =
  | { ok: true; revision: number }
  | { ok: false; error: string; issues?: Array<{ path: string; message: string }> };

export async function savePageDraft(input: SavePageDraftInput): Promise<SavePageDraftResult> {
  const actor = await requirePermission("pages:manage");
  const parsed = pageDocumentSchema.safeParse(input.document);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Page validation failed",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    };
  }
  const name = input.name.trim().slice(0, 160);
  const slug = normalizePageSlug(input.slug);
  const conversionGoal = input.conversionGoal.trim().slice(0, 80);
  if (!name || !slug || !input.brandId) return { ok: false, error: "Name, slug and brand are required" };
  await assertBrandAndCampaign(input.brandId, input.campaignId);
  const { db, client } = getDatabase();
  try {
    const [saved] = await db.update(landingPages).set({
      name,
      slug,
      brandId: input.brandId,
      campaignId: input.campaignId || null,
      conversionGoal: conversionGoal || null,
      draftContent: json(parsed.data),
      draftRevision: input.expectedRevision + 1,
      updatedAt: new Date(),
      updatedBy: actor.id
    }).where(and(eq(landingPages.id, input.id), eq(landingPages.draftRevision, input.expectedRevision))).returning({ revision: landingPages.draftRevision });
    if (!saved) return { ok: false, error: "This page changed elsewhere. Reload before saving again." };
    revalidatePath("/pages");
    revalidatePath(`/pages/${input.id}`);
    return { ok: true, revision: saved.revision };
  } catch (error) {
    const message = error instanceof Error && error.message.includes("landing_pages_brand_slug_uidx")
      ? "That slug is already used by another page in this brand."
      : error instanceof Error ? error.message : "Could not save page";
    return { ok: false, error: message };
  } finally {
    await client.end();
  }
}

async function availableCopySlug(brandId: string, baseSlug: string) {
  const { db, client } = getDatabase();
  try {
    for (let index = 1; index <= 50; index += 1) {
      const slug = `${baseSlug}-copy${index === 1 ? "" : `-${index}`}`;
      const [existing] = await db.select({ id: landingPages.id }).from(landingPages)
        .where(and(eq(landingPages.brandId, brandId), eq(landingPages.slug, slug))).limit(1);
      if (!existing) return slug;
    }
    throw new Error("COPY_SLUG_EXHAUSTED");
  } finally {
    await client.end();
  }
}

export async function duplicatePage(input: { sourceId: string; targetBrandId: string; targetCampaignId?: string | null }) {
  const actor = await requirePermission("pages:manage");
  await assertBrandAndCampaign(input.targetBrandId, input.targetCampaignId || null);
  const { db, client } = getDatabase();
  let source: { name: string; slug: string; conversionGoal: string | null; draftContent: unknown } | undefined;
  try {
    [source] = await db.select({ name: landingPages.name, slug: landingPages.slug, conversionGoal: landingPages.conversionGoal, draftContent: landingPages.draftContent })
      .from(landingPages).where(eq(landingPages.id, input.sourceId)).limit(1);
  } finally {
    await client.end();
  }
  if (!source) throw new Error("SOURCE_PAGE_NOT_FOUND");
  const parsed = pageDocumentSchema.safeParse(source.draftContent);
  const document: PageDocument = reseedPageDocument(parsed.success ? parsed.data : instantiatePageTemplate("minimal"));
  const slug = await availableCopySlug(input.targetBrandId, source.slug);
  const connection = getDatabase();
  try {
    const [created] = await connection.db.insert(landingPages).values({
      brandId: input.targetBrandId,
      campaignId: input.targetCampaignId || null,
      name: `${source.name} Copy`.slice(0, 160),
      slug,
      conversionGoal: source.conversionGoal,
      draftContent: json(document),
      createdBy: actor.id,
      updatedBy: actor.id
    }).returning({ id: landingPages.id });
    if (!created) throw new Error("PAGE_DUPLICATE_FAILED");
    revalidatePath("/pages");
    return { id: created.id };
  } finally {
    await connection.client.end();
  }
}

export async function archivePage(formData: FormData) {
  const actor = await requirePermission("pages:manage");
  const id = String(formData.get("id") ?? "");
  const { db, client } = getDatabase();
  try {
    await db.update(landingPages).set({ status: "archived", updatedAt: new Date(), updatedBy: actor.id }).where(eq(landingPages.id, id));
  } finally {
    await client.end();
  }
  revalidatePath("/pages");
}
