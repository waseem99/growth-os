"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDatabase, assets, brands, campaigns, domains, landingPages } from "@growth-os/db";
import { clearAssetReferences, defaultPageSeo, pageDocumentSchema, pageSeoSchema, type PageDocument } from "@growth-os/page-engine";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/user-access";
import { applyAdCreative, canonicalConversionGoal, defaultConversionGoalForTemplate, instantiatePageTemplate, normalizePageSlug, reseedPageDocument } from "@/lib/page-input";
import { parseAssetMetadata } from "@/lib/asset-references";
import { syncDraftAssetUsages, validatePageAssetReferences } from "@/lib/asset-usage-db";

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
    const domainRows = await db.select({ id: domains.id, isPrimary: domains.isPrimary }).from(domains).where(and(eq(domains.brandId, brandId), eq(domains.status, "verified")));
    const primary = domainRows.find((domain) => domain.isPrimary) ?? domainRows[0] ?? null;
    return { defaultDomainId: primary?.id ?? null };
  } finally { await client.end(); }
}

async function loadCreative(creativeAssetId: string, brandId: string, campaignId: string | null) {
  const { db, client } = getDatabase();
  try {
    const [asset] = await db.select({ id: assets.id, brandId: assets.brandId, metadata: assets.metadata }).from(assets).where(eq(assets.id, creativeAssetId)).limit(1);
    if (!asset || asset.brandId !== brandId) throw new Error("CREATIVE_BRAND_MISMATCH");
    const meta = parseAssetMetadata(asset.metadata);
    if (campaignId && meta.campaignId && meta.campaignId !== campaignId) throw new Error("CREATIVE_CAMPAIGN_MISMATCH");
    return { assetId: asset.id, headline: meta.adHeadline, primaryText: meta.adPrimaryText, cta: meta.adCta };
  } finally { await client.end(); }
}

export async function createPage(formData: FormData) {
  const actor = await requirePermission("pages:manage");
  const name = String(formData.get("name") ?? "").trim().slice(0, 160);
  const brandId = String(formData.get("brandId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "") || null;
  const creativeAssetId = String(formData.get("creativeAssetId") ?? "") || null;
  const templateKey = String(formData.get("templateKey") ?? "minimal");
  const conversionGoal = defaultConversionGoalForTemplate(templateKey);
  const slug = normalizePageSlug(String(formData.get("slug") ?? name));
  if (!name || !slug || !brandId) throw new Error("PAGE_INPUT_REQUIRED");
  const { defaultDomainId } = await assertBrandAndCampaign(brandId, campaignId);
  let document = instantiatePageTemplate(templateKey);
  if (creativeAssetId) document = applyAdCreative(document, await loadCreative(creativeAssetId, brandId, campaignId));
  const seo = defaultPageSeo(name);
  const { db, client } = getDatabase(); let id = "";
  try {
    const [created] = await db.insert(landingPages).values({ brandId, domainId: defaultDomainId, campaignId, name, slug, conversionGoal, draftContent: json(document), draftSeo: json(seo), createdBy: actor.id, updatedBy: actor.id }).returning({ id: landingPages.id });
    if (!created) throw new Error("PAGE_CREATE_FAILED");
    id = created.id;
  } finally { await client.end(); }
  await syncDraftAssetUsages(id, document);
  await writeAudit({ actorUserId: actor.id, action: "page.created", entityType: "landing_page", entityId: id, after: { brandId, campaignId, domainId: defaultDomainId, creativeAssetId, name, slug, templateKey, conversionGoal, revision: 1 } });
  redirect(`/pages/${id}`);
}

export type SavePageDraftInput = { id: string; expectedRevision: number; name: string; slug: string; brandId: string; campaignId: string | null; conversionGoal: string; document: unknown };
export type SavePageDraftResult = { ok: true; revision: number } | { ok: false; error: string; issues?: Array<{ path: string; message: string }> };

export async function savePageDraft(input: SavePageDraftInput): Promise<SavePageDraftResult> {
  const actor = await requirePermission("pages:manage");
  const parsed = pageDocumentSchema.safeParse(input.document);
  if (!parsed.success) return { ok: false, error: "Page validation failed", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) };
  const name = input.name.trim().slice(0, 160), slug = normalizePageSlug(input.slug), conversionGoal = canonicalConversionGoal(input.conversionGoal);
  if (!name || !slug || !input.brandId) return { ok: false, error: "Name, slug and brand are required" };
  if (!conversionGoal) return { ok: false, error: "Conversion goal must be signup_complete, purchase or subscription_started." };
  await assertBrandAndCampaign(input.brandId, input.campaignId);
  const assetValidation = await validatePageAssetReferences(input.brandId, parsed.data);
  if (!assetValidation.ok) return { ok: false, error: `Invalid or cross-brand asset reference: ${assetValidation.invalid.join(", ")}` };
  const { db, client } = getDatabase(); let revision = 0;
  try {
    const [saved] = await db.update(landingPages).set({ name, slug, brandId: input.brandId, campaignId: input.campaignId || null, conversionGoal, draftContent: json(parsed.data), draftRevision: input.expectedRevision + 1, updatedAt: new Date(), updatedBy: actor.id }).where(and(eq(landingPages.id, input.id), eq(landingPages.draftRevision, input.expectedRevision))).returning({ revision: landingPages.draftRevision });
    if (!saved) return { ok: false, error: "This page changed elsewhere. Reload before saving again." };
    revision = saved.revision;
  } catch (error) {
    const message = error instanceof Error && error.message.includes("landing_pages_brand_slug_uidx") ? "That slug is already used by another page in this brand." : error instanceof Error ? error.message : "Could not save page";
    return { ok: false, error: message };
  } finally { await client.end(); }
  await syncDraftAssetUsages(input.id, parsed.data);
  await writeAudit({ actorUserId: actor.id, action: "page.draft_saved", entityType: "landing_page", entityId: input.id, before: { revision: input.expectedRevision }, after: { revision, name, slug, brandId: input.brandId, campaignId: input.campaignId, conversionGoal, blockCount: parsed.data.blocks.length } });
  revalidatePath("/pages"); revalidatePath(`/pages/${input.id}`); revalidatePath(`/pages/${input.id}/publishing`);
  return { ok: true, revision };
}

async function availableCopySlug(brandId: string, baseSlug: string) {
  const { db, client } = getDatabase();
  try { for (let index = 1; index <= 50; index += 1) { const slug = `${baseSlug}-copy${index === 1 ? "" : `-${index}`}`; const [existing] = await db.select({ id: landingPages.id }).from(landingPages).where(and(eq(landingPages.brandId, brandId), eq(landingPages.slug, slug))).limit(1); if (!existing) return slug; } throw new Error("COPY_SLUG_EXHAUSTED"); }
  finally { await client.end(); }
}

export async function duplicatePage(input: { sourceId: string; targetBrandId: string; targetCampaignId?: string | null }) {
  const actor = await requirePermission("pages:manage"); const { defaultDomainId } = await assertBrandAndCampaign(input.targetBrandId, input.targetCampaignId || null);
  const { db, client } = getDatabase(); let source: { name: string; slug: string; brandId: string; conversionGoal: string | null; draftContent: unknown; draftSeo: unknown } | undefined;
  try { [source] = await db.select({ name: landingPages.name, slug: landingPages.slug, brandId: landingPages.brandId, conversionGoal: landingPages.conversionGoal, draftContent: landingPages.draftContent, draftSeo: landingPages.draftSeo }).from(landingPages).where(eq(landingPages.id, input.sourceId)).limit(1); }
  finally { await client.end(); }
  if (!source) throw new Error("SOURCE_PAGE_NOT_FOUND");
  const parsed = pageDocumentSchema.safeParse(source.draftContent); const baseDocument: PageDocument = reseedPageDocument(parsed.success ? parsed.data : instantiatePageTemplate("minimal")); const sameBrand = source.brandId === input.targetBrandId; const document = sameBrand ? baseDocument : clearAssetReferences(baseDocument);
  const conversionGoal = canonicalConversionGoal(source.conversionGoal) ?? defaultConversionGoalForTemplate(parsed.success ? parsed.data.templateKey : "minimal");
  const seoParsed = pageSeoSchema.safeParse(source.draftSeo); const seo = seoParsed.success ? { ...seoParsed.data, canonicalUrl: null, socialAssetId: sameBrand ? seoParsed.data.socialAssetId : null } : defaultPageSeo(`${source.name} Copy`); const slug = await availableCopySlug(input.targetBrandId, source.slug);
  const connection = getDatabase(); let createdId = "";
  try { const [created] = await connection.db.insert(landingPages).values({ brandId: input.targetBrandId, domainId: defaultDomainId, campaignId: input.targetCampaignId || null, name: `${source.name} Copy`.slice(0, 160), slug, conversionGoal, draftContent: json(document), draftSeo: json(seo), createdBy: actor.id, updatedBy: actor.id }).returning({ id: landingPages.id }); if (!created) throw new Error("PAGE_DUPLICATE_FAILED"); createdId = created.id; }
  finally { await connection.client.end(); }
  await syncDraftAssetUsages(createdId, document);
  await writeAudit({ actorUserId: actor.id, action: "page.duplicated", entityType: "landing_page", entityId: createdId, after: { sourceId: input.sourceId, targetBrandId: input.targetBrandId, targetCampaignId: input.targetCampaignId || null, domainId: defaultDomainId, slug, conversionGoal } });
  revalidatePath("/pages"); return { id: createdId };
}

export async function archivePage(formData: FormData) {
  const actor = await requirePermission("pages:manage"); const id = String(formData.get("id") ?? ""); const { db, client } = getDatabase();
  try { await db.update(landingPages).set({ status: "archived", updatedAt: new Date(), updatedBy: actor.id }).where(eq(landingPages.id, id)); }
  finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "page.archived", entityType: "landing_page", entityId: id, after: { status: "archived" } });
  revalidatePath("/pages");
}
