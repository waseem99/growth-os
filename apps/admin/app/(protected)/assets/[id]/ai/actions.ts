"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  assetMetadataPrompt,
  assetMetadataSuggestionSchema,
  generateValidated,
  providerFromEnv
} from "@growth-os/ai";
import { aiJobs, assets, brands, getDatabase, type JsonObject } from "@growth-os/db";
import { completeAiJob, failAiJob, startAiJob } from "@/lib/ai-jobs";
import { requirePermission } from "@/lib/user-access";

const json = (value: unknown) => value as JsonObject;
const clean = (value: FormDataEntryValue | null, max = 1000) => String(value ?? "").trim().slice(0, max);

export async function suggestAssetMetadata(formData: FormData) {
  const actor = await requirePermission("ai:use");
  const assetId = clean(formData.get("assetId"), 80);
  const context = clean(formData.get("context"), 1000);
  const { db, client } = getDatabase();
  let asset: { id: string; brandId: string; brandName: string; mimeType: string; width: number | null; height: number | null; title: string | null; altText: string | null; metadata: unknown } | undefined;
  try {
    [asset] = await db.select({ id: assets.id, brandId: assets.brandId, brandName: brands.name, mimeType: assets.mimeType, width: assets.width, height: assets.height, title: assets.title, altText: assets.altText, metadata: assets.metadata }).from(assets).innerJoin(brands, eq(brands.id, assets.brandId)).where(eq(assets.id, assetId)).limit(1);
  } finally { await client.end(); }
  if (!asset) redirect("/assets?error=asset-not-found");
  const metadata = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {};
  const jobId = await startAiJob({ userId: actor.id, brandId: asset.brandId, action: "suggest_asset_metadata", targetType: "asset", targetId: asset.id, metadata: { context } });
  try {
    const prompt = assetMetadataPrompt({
      filename: typeof metadata.originalName === "string" ? metadata.originalName : null,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      currentTitle: asset.title,
      currentAltText: asset.altText,
      context: `${asset.brandName}. ${context}`.trim()
    });
    const generated = await generateValidated(providerFromEnv(), { action: "suggest_asset_metadata", system: prompt.system, user: prompt.user, schemaName: "growthos_asset_metadata", schema: assetMetadataSuggestionSchema });
    await completeAiJob(jobId, { provider: generated.provider, model: generated.model, latencyMs: generated.latencyMs, usage: generated.usage, metadata: { context, output: generated.data } });
    redirect(`/assets/${asset.id}/ai?job=${jobId}`);
  } catch (error) {
    unstable_rethrow(error);
    await failAiJob(jobId, error);
    redirect(`/assets/${asset.id}/ai?error=${encodeURIComponent("Asset suggestion failed; metadata was not changed")}`);
  }
}

export async function applyAssetMetadataSuggestion(formData: FormData) {
  const actor = await requirePermission("assets:manage");
  await requirePermission("ai:use");
  const assetId = clean(formData.get("assetId"), 80);
  const jobId = clean(formData.get("jobId"), 80);
  const { db, client } = getDatabase();
  try {
    const [asset] = await db.select({ id: assets.id, metadata: assets.metadata }).from(assets).where(eq(assets.id, assetId)).limit(1);
    const [job] = await db.select({ id: aiJobs.id, action: aiJobs.action, status: aiJobs.status, targetId: aiJobs.targetId, metadata: aiJobs.metadata }).from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1);
    if (!asset || !job || job.status !== "completed" || job.action !== "suggest_asset_metadata" || job.targetId !== assetId) throw new Error("AI_ASSET_JOB_NOT_APPLICABLE");
    const jobMetadata = job.metadata as Record<string, unknown>;
    const suggestion = assetMetadataSuggestionSchema.parse(jobMetadata.output);
    const current = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {};
    await db.update(assets).set({ title: suggestion.title, altText: suggestion.altText, metadata: json({ ...current, tags: suggestion.tags }) }).where(eq(assets.id, assetId));
    await db.update(aiJobs).set({ metadata: json({ ...jobMetadata, appliedAt: new Date().toISOString(), appliedBy: actor.id }) }).where(eq(aiJobs.id, jobId));
  } finally { await client.end(); }
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}/ai`);
  redirect(`/assets/${assetId}/ai?applied=${jobId}`);
}
