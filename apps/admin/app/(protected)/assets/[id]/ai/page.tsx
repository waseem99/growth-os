import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { assetMetadataSuggestionSchema, providerFromEnv } from "@growth-os/ai";
import { aiJobs, assets, brands, getDatabase } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { applyAssetMetadataSuggestion, suggestAssetMetadata } from "./actions";

export default async function AssetAiPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; applied?: string }> }) {
  await requirePermission("ai:use");
  const { id } = await params;
  const query = await searchParams;
  const { db, client } = getDatabase();
  try {
    const [asset] = await db.select({ id: assets.id, title: assets.title, altText: assets.altText, mimeType: assets.mimeType, width: assets.width, height: assets.height, brandName: brands.name }).from(assets).innerJoin(brands, eq(brands.id, assets.brandId)).where(eq(assets.id, id)).limit(1);
    if (!asset) return <main className="shell"><p>Asset not found.</p></main>;
    const jobs = await db.select({ id: aiJobs.id, status: aiJobs.status, metadata: aiJobs.metadata, error: aiJobs.error, provider: aiJobs.provider, model: aiJobs.model, createdAt: aiJobs.createdAt }).from(aiJobs).where(and(eq(aiJobs.targetType, "asset"), eq(aiJobs.targetId, id), eq(aiJobs.action, "suggest_asset_metadata"))).orderBy(desc(aiJobs.createdAt)).limit(10);
    const configured = Boolean(providerFromEnv());
    return <main className="shell compact-shell">
      <div className="section-heading"><Link href={`/assets/${id}`}>← Back to asset</Link><p className="eyebrow">AI asset assistant · {asset.brandName}</p><h1>{asset.title || "Untitled asset"}</h1><p>{asset.mimeType}{asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}. GrowthOS sends file/context metadata only in P0; it does not claim pixel-level visual inspection.</p></div>
      {query.error ? <div className="ai-notice ai-error">{decodeURIComponent(query.error)}</div> : null}
      {query.applied ? <div className="ai-notice ai-ready">Suggested title, alt text and tags applied.</div> : null}
      <form className="settings-card" action={suggestAssetMetadata}><input type="hidden" name="assetId" value={id}/><h2>Suggest metadata</h2><p>Current title: <strong>{asset.title || "none"}</strong><br/>Current alt: <strong>{asset.altText || "none"}</strong></p><label>Usage/context<textarea name="context" rows={4} placeholder="Example: hero image for SkillUp Ranchers promotion aimed at TikTok traffic." required/></label><button type="submit" disabled={!configured}>Generate metadata suggestion</button></form>
      {!configured ? <div className="ai-notice ai-warning">Provider not configured. Manual asset metadata editing remains available.</div> : null}
      <section className="ai-results"><h2>Recent suggestions</h2>{jobs.length === 0 ? <p>No suggestions yet.</p> : jobs.map((job) => {
        const metadata = job.metadata && typeof job.metadata === "object" ? job.metadata as Record<string, unknown> : {};
        const parsed = assetMetadataSuggestionSchema.safeParse(metadata.output);
        return <article className="ai-result-card" key={job.id}><header><strong>Asset metadata</strong><span className={`ai-status ai-${job.status}`}>{job.status}</span></header>{parsed.success ? <><h3>{parsed.data.title}</h3><p><strong>Alt:</strong> {parsed.data.altText}</p><div className="tag-row">{parsed.data.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><form action={applyAssetMetadataSuggestion} className="ai-apply"><input type="hidden" name="assetId" value={id}/><input type="hidden" name="jobId" value={job.id}/><button className="primary-button" type="submit">Apply metadata</button></form></> : <p>{job.status === "failed" ? "Suggestion failed; asset metadata was not changed." : "No structured output available."}</p>}<small>{job.provider || "pending"}{job.model ? ` · ${job.model}` : ""} · {job.createdAt.toISOString()}</small></article>;
      })}</section>
    </main>;
  } finally { await client.end(); }
}
