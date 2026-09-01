"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  applyBlockRewrite,
  applyCopyVariant,
  applyFaqSuggestion,
  applySeoSuggestion,
  blockRewritePrompt,
  blockRewriteSuggestionSchema,
  copyVariantsSuggestionSchema,
  faqPrompt,
  faqSuggestionSchema,
  generateValidated,
  inspectPageQuality,
  providerFromEnv,
  seoPrompt,
  seoSuggestionSchema,
  variantsPrompt
} from "@growth-os/ai";
import { aiJobs, assets, brands, campaigns, getDatabase, landingPages, type JsonObject } from "@growth-os/db";
import { collectAssetIds, pageDocumentSchema, pageSeoSchema } from "@growth-os/page-engine";
import { completeAiJob, completeLocalAiJob, failAiJob, startAiJob } from "@/lib/ai-jobs";
import { syncDraftAssetUsages } from "@/lib/asset-usage-db";
import { requirePermission } from "@/lib/user-access";

const json = (value: unknown) => value as JsonObject;
const clean = (value: FormDataEntryValue | null, max = 1200) => String(value ?? "").trim().slice(0, max);

type PageContext = {
  id: string;
  brandId: string;
  brandName: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignPlatform: string | null;
  campaignObjective: string | null;
  revision: number;
  document: ReturnType<typeof pageDocumentSchema.parse>;
  seo: ReturnType<typeof pageSeoSchema.parse>;
};

async function loadPage(pageId: string): Promise<PageContext> {
  const { db, client } = getDatabase();
  try {
    const [row] = await db.select({
      id: landingPages.id,
      brandId: landingPages.brandId,
      brandName: brands.name,
      campaignId: landingPages.campaignId,
      campaignName: campaigns.name,
      campaignPlatform: campaigns.platform,
      campaignObjective: campaigns.objective,
      revision: landingPages.draftRevision,
      content: landingPages.draftContent,
      seo: landingPages.draftSeo
    }).from(landingPages).innerJoin(brands, eq(brands.id, landingPages.brandId)).leftJoin(campaigns, eq(campaigns.id, landingPages.campaignId)).where(eq(landingPages.id, pageId)).limit(1);
    if (!row) throw new Error("PAGE_NOT_FOUND");
    return { ...row, document: pageDocumentSchema.parse(row.content), seo: pageSeoSchema.parse(row.seo) };
  } finally { await client.end(); }
}

const contextForModel = (page: PageContext) => ({
  brand: page.brandName,
  campaign: page.campaignName,
  platform: page.campaignPlatform,
  objective: page.campaignObjective
});

export async function runPageAi(formData: FormData) {
  const actor = await requirePermission("ai:use");
  const pageId = clean(formData.get("pageId"), 80);
  const action = clean(formData.get("action"), 80) as "rewrite_block" | "generate_variants" | "suggest_seo" | "suggest_faq" | "quality_check";
  const page = await loadPage(pageId);
  const jobId = await startAiJob({ userId: actor.id, brandId: page.brandId, action, targetType: "landing_page", targetId: pageId, metadata: { draftRevision: page.revision } });
  try {
    if (action === "quality_check") {
      const assetIds = collectAssetIds(page.document);
      const { db, client } = getDatabase();
      let assetRows: Array<{ id: string; title: string | null; altText: string | null }> = [];
      try { if (assetIds.length) assetRows = await db.select({ id: assets.id, title: assets.title, altText: assets.altText }).from(assets).where(and(eq(assets.brandId, page.brandId), inArray(assets.id, assetIds))); }
      finally { await client.end(); }
      const output = inspectPageQuality({ document: page.document, seo: page.seo, assets: assetRows });
      await completeLocalAiJob(jobId, { draftRevision: page.revision, output });
      redirect(`/pages/${pageId}/ai?job=${jobId}`);
    }

    const provider = providerFromEnv();
    const modelContext = contextForModel(page);
    if (action === "rewrite_block") {
      const blockId = clean(formData.get("blockId"), 80);
      const instruction = clean(formData.get("instruction"), 1200);
      const block = page.document.blocks.find((candidate) => candidate.id === blockId);
      if (!block || !instruction) throw new Error("AI_REWRITE_INPUT_REQUIRED");
      const prompt = blockRewritePrompt({ block, instruction, context: modelContext });
      const generated = await generateValidated(provider, { action, system: prompt.system, user: prompt.user, schemaName: "growthos_block_rewrite", schema: blockRewriteSuggestionSchema });
      await completeAiJob(jobId, { provider: generated.provider, model: generated.model, latencyMs: generated.latencyMs, usage: generated.usage, metadata: { draftRevision: page.revision, blockId, instruction, output: generated.data } });
    } else if (action === "generate_variants") {
      const direction = clean(formData.get("direction"), 800);
      const prompt = variantsPrompt({ document: page.document, direction, context: modelContext });
      const generated = await generateValidated(provider, { action, system: prompt.system, user: prompt.user, schemaName: "growthos_copy_variants", schema: copyVariantsSuggestionSchema });
      await completeAiJob(jobId, { provider: generated.provider, model: generated.model, latencyMs: generated.latencyMs, usage: generated.usage, metadata: { draftRevision: page.revision, direction, output: generated.data } });
    } else if (action === "suggest_seo") {
      const prompt = seoPrompt({ document: page.document, seo: page.seo, context: modelContext });
      const generated = await generateValidated(provider, { action, system: prompt.system, user: prompt.user, schemaName: "growthos_seo_suggestion", schema: seoSuggestionSchema });
      await completeAiJob(jobId, { provider: generated.provider, model: generated.model, latencyMs: generated.latencyMs, usage: generated.usage, metadata: { draftRevision: page.revision, output: generated.data } });
    } else if (action === "suggest_faq") {
      const prompt = faqPrompt({ document: page.document, context: modelContext });
      const generated = await generateValidated(provider, { action, system: prompt.system, user: prompt.user, schemaName: "growthos_faq_suggestion", schema: faqSuggestionSchema });
      await completeAiJob(jobId, { provider: generated.provider, model: generated.model, latencyMs: generated.latencyMs, usage: generated.usage, metadata: { draftRevision: page.revision, output: generated.data } });
    } else throw new Error("UNKNOWN_AI_ACTION");
    redirect(`/pages/${pageId}/ai?job=${jobId}`);
  } catch (error) {
    unstable_rethrow(error);
    await failAiJob(jobId, error);
    const message = error instanceof Error && error.message === "AI_NOT_CONFIGURED" ? "AI provider is not configured; quality check remains available" : "Suggestion failed; the draft was not changed";
    redirect(`/pages/${pageId}/ai?error=${encodeURIComponent(message)}`);
  }
}

export async function applyPageAiSuggestion(formData: FormData) {
  const actor = await requirePermission("pages:manage");
  await requirePermission("ai:use");
  const pageId = clean(formData.get("pageId"), 80);
  const jobId = clean(formData.get("jobId"), 80);
  const variantIndex = Number(clean(formData.get("variantIndex"), 10) || "0");
  const page = await loadPage(pageId);
  const { db, client } = getDatabase();
  try {
    const [job] = await db.select({ id: aiJobs.id, action: aiJobs.action, status: aiJobs.status, targetId: aiJobs.targetId, metadata: aiJobs.metadata }).from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1);
    if (!job || job.status !== "completed" || job.targetId !== pageId) throw new Error("AI_JOB_NOT_APPLICABLE");
    const metadata = job.metadata as Record<string, unknown>;
    if (metadata.draftRevision !== page.revision) redirect(`/pages/${pageId}/ai?error=${encodeURIComponent("This suggestion is stale because the page changed. Generate it again.")}`);
    const output = metadata.output;
    let document = page.document;
    let seo = page.seo;
    if (job.action === "rewrite_block") {
      const parsed = blockRewriteSuggestionSchema.parse(output);
      const blockId = String(metadata.blockId ?? "");
      document = pageDocumentSchema.parse({ ...document, blocks: document.blocks.map((block) => block.id === blockId ? applyBlockRewrite(block, parsed) : block) });
    } else if (job.action === "generate_variants") {
      document = applyCopyVariant(document, copyVariantsSuggestionSchema.parse(output), variantIndex);
    } else if (job.action === "suggest_seo") {
      seo = applySeoSuggestion(seo, seoSuggestionSchema.parse(output));
    } else if (job.action === "suggest_faq") {
      document = applyFaqSuggestion(document, faqSuggestionSchema.parse(output));
    } else throw new Error("AI_JOB_HAS_NO_APPLY_ACTION");

    const [updated] = await db.update(landingPages).set({
      draftContent: json(document),
      draftSeo: json(seo),
      draftRevision: page.revision + 1,
      updatedAt: new Date(),
      updatedBy: actor.id
    }).where(and(eq(landingPages.id, pageId), eq(landingPages.draftRevision, page.revision))).returning({ revision: landingPages.draftRevision });
    if (!updated) throw new Error("PAGE_CHANGED_DURING_AI_APPLY");
    await db.update(aiJobs).set({ metadata: json({ ...metadata, appliedAt: new Date().toISOString(), appliedBy: actor.id, appliedVariantIndex: job.action === "generate_variants" ? variantIndex : null }) }).where(eq(aiJobs.id, jobId));
    await syncDraftAssetUsages(pageId, document);
  } finally { await client.end(); }
  revalidatePath(`/pages/${pageId}`);
  revalidatePath(`/pages/${pageId}/ai`);
  revalidatePath(`/preview/pages/${pageId}`);
  redirect(`/pages/${pageId}/ai?applied=${jobId}`);
}
