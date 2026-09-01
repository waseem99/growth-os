"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  aiPageBriefSchema,
  composeGeneratedPage,
  generateValidated,
  generatedPageCopySchema,
  pageGenerationPrompt,
  providerFromEnv
} from "@growth-os/ai";
import { brands, campaigns, getDatabase, landingPages, type JsonObject } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { completeAiJob, failAiJob, startAiJob } from "@/lib/ai-jobs";
import { normalizePageSlug } from "@/lib/page-input";

const json = (value: unknown) => value as JsonObject;
const value = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);

async function availableSlug(brandId: string, requested: string) {
  const base = normalizePageSlug(requested) || `ai-page-${Date.now().toString(36)}`;
  const { db, client } = getDatabase();
  try {
    for (let index = 0; index < 30; index += 1) {
      const candidate = index === 0 ? base : `${base}-${index + 1}`;
      const [existing] = await db.select({ id: landingPages.id }).from(landingPages).where(and(eq(landingPages.brandId, brandId), eq(landingPages.slug, candidate))).limit(1);
      if (!existing) return candidate;
    }
    throw new Error("AI_PAGE_SLUG_EXHAUSTED");
  } finally { await client.end(); }
}

export async function generateAiPageDraft(formData: FormData) {
  const actor = await requirePermission("ai:use");
  const brandId = value(formData, "brandId", 80);
  const campaignId = value(formData, "campaignId", 80) || null;
  if (!brandId) redirect("/ai?error=brand-required");

  const { db, client } = getDatabase();
  let brand: { id: string; name: string } | undefined;
  let campaign: { id: string; brandId: string; name: string; platform: string; objective: string } | undefined;
  try {
    [brand] = await db.select({ id: brands.id, name: brands.name }).from(brands).where(and(eq(brands.id, brandId), eq(brands.status, "active"))).limit(1);
    if (campaignId) [campaign] = await db.select({ id: campaigns.id, brandId: campaigns.brandId, name: campaigns.name, platform: campaigns.platform, objective: campaigns.objective }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  } finally { await client.end(); }
  if (!brand || (campaignId && (!campaign || campaign.brandId !== brand.id))) redirect("/ai?error=context-invalid");

  const briefResult = aiPageBriefSchema.safeParse({
    brandName: brand.name,
    productName: value(formData, "productName", 160) || brand.name,
    platform: value(formData, "platform", 80) || campaign?.platform || "paid-social",
    audience: value(formData, "audience", 500),
    offer: value(formData, "offer", 700),
    conversionGoal: value(formData, "conversionGoal", 120) || campaign?.objective || "subscription_started",
    tone: value(formData, "tone", 240) || "clear, credible and conversion-focused",
    positioning: value(formData, "positioning", 600),
    templateKey: value(formData, "templateKey", 100),
    stylePreset: value(formData, "stylePreset", 100) || undefined,
    locale: value(formData, "locale", 20) || "en-PK"
  });
  if (!briefResult.success) redirect(`/ai?error=${encodeURIComponent("Complete audience, offer and positioning before generating")}`);

  const jobId = await startAiJob({
    userId: actor.id,
    brandId,
    action: "generate_page",
    targetType: "landing_page_draft",
    metadata: { brief: briefResult.data, campaignId }
  });
  try {
    const prompts = pageGenerationPrompt(briefResult.data);
    const generated = await generateValidated(providerFromEnv(), {
      action: "generate_page",
      system: prompts.system,
      user: prompts.user,
      schemaName: "growthos_generated_page_copy",
      schema: generatedPageCopySchema
    });
    const composed = composeGeneratedPage(briefResult.data, generated.data);
    const slug = await availableSlug(brandId, value(formData, "slug", 180) || generated.data.pageName);
    const connection = getDatabase();
    let pageId = "";
    try {
      const [created] = await connection.db.insert(landingPages).values({
        brandId,
        campaignId,
        name: generated.data.pageName,
        slug,
        conversionGoal: briefResult.data.conversionGoal,
        draftContent: json(composed.document),
        draftSeo: json(composed.seo),
        createdBy: actor.id,
        updatedBy: actor.id
      }).returning({ id: landingPages.id });
      if (!created) throw new Error("AI_PAGE_CREATE_FAILED");
      pageId = created.id;
    } finally { await connection.client.end(); }
    await completeAiJob(jobId, {
      provider: generated.provider,
      model: generated.model,
      latencyMs: generated.latencyMs,
      usage: generated.usage,
      metadata: { brief: briefResult.data, campaignId, pageId, output: generated.data }
    });
    redirect(`/pages/${pageId}?created=ai`);
  } catch (error) {
    await failAiJob(jobId, error);
    const code = error instanceof Error && error.message === "AI_NOT_CONFIGURED" ? "AI is not configured yet; manual page creation still works" : "AI generation failed; no draft was changed";
    redirect(`/ai?error=${encodeURIComponent(code)}`);
  }
}
