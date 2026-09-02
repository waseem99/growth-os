"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { brands, campaigns, getDatabase, offerVersions, offers } from "@growth-os/db";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/user-access";

const clean = (value: FormDataEntryValue | null, max = 240) => String(value ?? "").trim().slice(0, max);
const optional = (value: FormDataEntryValue | null, max = 240) => clean(value, max) || null;
const dateOrNull = (value: FormDataEntryValue | null) => { const raw = clean(value, 40); if (!raw) return null; const date = new Date(raw); if (Number.isNaN(date.getTime())) throw new Error("INVALID_CAMPAIGN_DATE"); return date; };

async function validateCampaignRefs(brandId: string, offerVersionId: string | null) {
  const { db, client } = getDatabase();
  try {
    const [brand] = await db.select({ id: brands.id, status: brands.status }).from(brands).where(eq(brands.id, brandId)).limit(1);
    if (!brand || brand.status !== "active") throw new Error("BRAND_NOT_ACTIVE");
    if (offerVersionId) {
      const [offer] = await db.select({ versionId: offerVersions.id, brandId: offers.brandId }).from(offerVersions).innerJoin(offers, eq(offers.id, offerVersions.offerId)).where(eq(offerVersions.id, offerVersionId)).limit(1);
      if (!offer || offer.brandId !== brandId) throw new Error("OFFER_BRAND_MISMATCH");
    }
  } finally { await client.end(); }
}

export async function createCampaign(formData: FormData) {
  const actor = await requirePermission("campaigns:manage");
  const name = clean(formData.get("name"), 160), brandId = clean(formData.get("brandId"), 80), platform = clean(formData.get("platform"), 80).toLowerCase(), objective = clean(formData.get("objective"), 120), offerVersionId = optional(formData.get("offerVersionId"), 80);
  if (!name || !brandId || !platform || !objective) throw new Error("CAMPAIGN_INPUT_REQUIRED");
  await validateCampaignRefs(brandId, offerVersionId);
  const startsAt = dateOrNull(formData.get("startsAt")), endsAt = dateOrNull(formData.get("endsAt"));
  if (startsAt && endsAt && endsAt < startsAt) throw new Error("CAMPAIGN_END_BEFORE_START");
  const externalIds = { campaignId: optional(formData.get("externalCampaignId")), adSetId: optional(formData.get("externalAdSetId")), adId: optional(formData.get("externalAdId")), creativeId: optional(formData.get("externalCreativeId")) };
  const utmDefaults = { source: optional(formData.get("utmSource")), medium: optional(formData.get("utmMedium")), campaign: optional(formData.get("utmCampaign")), term: optional(formData.get("utmTerm")), content: optional(formData.get("utmContent")) };
  const { db, client } = getDatabase(); let id = "";
  try { const [created] = await db.insert(campaigns).values({ brandId, offerVersionId, name, platform, objective, externalIds, utmDefaults, startsAt, endsAt, createdBy: actor.id, updatedBy: actor.id }).returning({ id: campaigns.id }); if (!created) throw new Error("CAMPAIGN_CREATE_FAILED"); id = created.id; }
  finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "campaign.created", entityType: "campaign", entityId: id, after: { brandId, name, platform, objective, offerVersionId, startsAt: startsAt?.toISOString() ?? null, endsAt: endsAt?.toISOString() ?? null } });
  revalidatePath("/campaigns");
}

const CAMPAIGN_STATES = new Set(["draft", "active", "paused", "completed", "archived"] as const);
export async function updateCampaignStatus(formData: FormData) {
  const actor = await requirePermission("campaigns:manage"); const id = clean(formData.get("id"), 80); const status = clean(formData.get("status"), 40) as "draft" | "active" | "paused" | "completed" | "archived";
  if (!id || !CAMPAIGN_STATES.has(status)) throw new Error("INVALID_CAMPAIGN_STATUS");
  const { db, client } = getDatabase(); let previous: string | null = null;
  try { const [row] = await db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, id)).limit(1); previous = row?.status ?? null; await db.update(campaigns).set({ status, updatedAt: new Date(), updatedBy: actor.id }).where(eq(campaigns.id, id)); }
  finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "campaign.status_updated", entityType: "campaign", entityId: id, before: { status: previous }, after: { status } });
  revalidatePath("/campaigns");
}

export async function updateCampaignTracking(formData: FormData) {
  const actor = await requirePermission("campaigns:manage"); const id = clean(formData.get("id"), 80); const brandId = clean(formData.get("brandId"), 80); if (!id || !brandId) throw new Error("CAMPAIGN_INPUT_REQUIRED");
  const externalIds = { campaignId: optional(formData.get("externalCampaignId")), adSetId: optional(formData.get("externalAdSetId")), adId: optional(formData.get("externalAdId")), creativeId: optional(formData.get("externalCreativeId")) };
  const utmDefaults = { source: optional(formData.get("utmSource")), medium: optional(formData.get("utmMedium")), campaign: optional(formData.get("utmCampaign")), term: optional(formData.get("utmTerm")), content: optional(formData.get("utmContent")) };
  const { db, client } = getDatabase();
  try { const [existing] = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.brandId, brandId))).limit(1); if (!existing) throw new Error("CAMPAIGN_NOT_FOUND"); await db.update(campaigns).set({ externalIds, utmDefaults, updatedAt: new Date(), updatedBy: actor.id }).where(eq(campaigns.id, id)); }
  finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "campaign.tracking_updated", entityType: "campaign", entityId: id, after: { brandId, hasExternalCampaignId: Boolean(externalIds.campaignId), utmSource: utmDefaults.source, utmMedium: utmDefaults.medium, utmCampaign: utmDefaults.campaign } });
  revalidatePath("/campaigns");
}
