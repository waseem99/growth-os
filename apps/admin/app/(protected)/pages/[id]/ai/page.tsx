import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { aiJobs, brands, getDatabase, landingPages } from "@growth-os/db";
import {
  blockRewriteSuggestionSchema,
  copyVariantsSuggestionSchema,
  faqSuggestionSchema,
  qualityReportSchema,
  seoSuggestionSchema,
  providerFromEnv
} from "@growth-os/ai";
import { pageDocumentSchema } from "@growth-os/page-engine";
import { requirePermission } from "@/lib/user-access";
import { applyPageAiSuggestion, runPageAi } from "./actions";

function JobResult({ job, pageId }: { job: { id: string; action: string; status: string; provider: string | null; model: string | null; metadata: unknown; error: string | null; createdAt: Date }; pageId: string }) {
  const metadata = job.metadata && typeof job.metadata === "object" ? job.metadata as Record<string, unknown> : {};
  const output = metadata.output;
  if (job.status === "failed") return <article className="ai-result-card"><header><strong>{job.action.replaceAll("_", " ")}</strong><span className="ai-status ai-failed">failed</span></header><p>The draft was not changed. {job.error?.startsWith("AI_NOT_CONFIGURED") ? "Configure a provider to use model-assisted actions." : "Generate a fresh suggestion to retry."}</p></article>;
  if (job.status !== "completed") return <article className="ai-result-card"><header><strong>{job.action.replaceAll("_", " ")}</strong><span className={`ai-status ai-${job.status}`}>{job.status}</span></header></article>;

  const footer = <small>{job.provider} · {job.model} · draft revision {String(metadata.draftRevision ?? "-")}</small>;
  if (job.action === "quality_check") {
    const parsed = qualityReportSchema.safeParse(output);
    if (!parsed.success) return null;
    return <article className="ai-result-card"><header><strong>Quality check</strong><b>{parsed.data.score}/100</b></header>{parsed.data.findings.length === 0 ? <p>No quality findings.</p> : <div className="ai-findings">{parsed.data.findings.map((finding, index) => <div key={`${finding.code}-${index}`} className={`ai-finding ai-${finding.severity}`}><strong>{finding.code.replaceAll("_", " ")}</strong><code>{finding.path}</code><p>{finding.message}</p><small>{finding.suggestion}</small></div>)}</div>}{footer}</article>;
  }
  if (job.action === "rewrite_block") {
    const parsed = blockRewriteSuggestionSchema.safeParse(output); if (!parsed.success) return null;
    return <article className="ai-result-card"><header><strong>Block rewrite</strong><span>{parsed.data.summary}</span></header><ul>{parsed.data.changes.map((change) => <li key={change.path}><code>{change.path}</code>: {change.value}</li>)}</ul><ApplyButton pageId={pageId} jobId={job.id} />{footer}</article>;
  }
  if (job.action === "generate_variants") {
    const parsed = copyVariantsSuggestionSchema.safeParse(output); if (!parsed.success) return null;
    return <article className="ai-result-card"><header><strong>Copy variants</strong><span>Choose one to apply to this draft.</span></header><div className="ai-variant-list">{parsed.data.variants.map((variant, index) => <div key={`${job.id}-${index}`}><b>{variant.name}</b><small>{variant.angle}</small><h3>{variant.headline}</h3><p>{variant.subheadline}</p><code>CTA: {variant.ctaLabel}</code><form action={applyPageAiSuggestion}><input type="hidden" name="pageId" value={pageId}/><input type="hidden" name="jobId" value={job.id}/><input type="hidden" name="variantIndex" value={index}/><button type="submit">Apply this variant</button></form></div>)}</div>{footer}</article>;
  }
  if (job.action === "suggest_seo") {
    const parsed = seoSuggestionSchema.safeParse(output); if (!parsed.success) return null;
    return <article className="ai-result-card"><header><strong>SEO suggestion</strong></header><h3>{parsed.data.title}</h3><p>{parsed.data.description}</p><small>{parsed.data.socialTitle} · {parsed.data.socialDescription}</small><ApplyButton pageId={pageId} jobId={job.id}/>{footer}</article>;
  }
  if (job.action === "suggest_faq") {
    const parsed = faqSuggestionSchema.safeParse(output); if (!parsed.success) return null;
    return <article className="ai-result-card"><header><strong>FAQ suggestion</strong></header>{parsed.data.items.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}<ApplyButton pageId={pageId} jobId={job.id}/>{footer}</article>;
  }
  return null;
}

function ApplyButton({ pageId, jobId }: { pageId: string; jobId: string }) {
  return <form action={applyPageAiSuggestion} className="ai-apply"><input type="hidden" name="pageId" value={pageId}/><input type="hidden" name="jobId" value={jobId}/><button className="primary-button" type="submit">Apply to current draft</button></form>;
}

export default async function PageAiAssistant({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; applied?: string }> }) {
  await requirePermission("ai:use");
  const { id } = await params;
  const query = await searchParams;
  const { db, client } = getDatabase();
  try {
    const [page] = await db.select({ id: landingPages.id, name: landingPages.name, revision: landingPages.draftRevision, content: landingPages.draftContent, brandName: brands.name }).from(landingPages).innerJoin(brands, eq(brands.id, landingPages.brandId)).where(eq(landingPages.id, id)).limit(1);
    if (!page) return <main className="shell"><p>Page not found.</p></main>;
    const document = pageDocumentSchema.parse(page.content);
    const jobs = await db.select({ id: aiJobs.id, action: aiJobs.action, status: aiJobs.status, provider: aiJobs.provider, model: aiJobs.model, metadata: aiJobs.metadata, error: aiJobs.error, createdAt: aiJobs.createdAt }).from(aiJobs).where(and(eq(aiJobs.targetType, "landing_page"), eq(aiJobs.targetId, id))).orderBy(desc(aiJobs.createdAt)).limit(16);
    const configured = Boolean(providerFromEnv());
    return <main className="shell compact-shell">
      <div className="section-heading"><Link href={`/pages/${id}`}>← Back to editor</Link><p className="eyebrow">AI assistant · {page.brandName}</p><h1>{page.name}</h1><p>Suggestions are generated against draft revision {page.revision}. They never apply or publish themselves.</p></div>
      {query.error ? <div className="ai-notice ai-error">{decodeURIComponent(query.error)}</div> : null}
      {query.applied ? <div className="ai-notice ai-ready">Suggestion applied. Review it in preview before publishing.</div> : null}

      <div className="ai-action-grid">
        <form className="settings-card" action={runPageAi}><input type="hidden" name="pageId" value={id}/><input type="hidden" name="action" value="rewrite_block"/><h2>Rewrite one block</h2><label>Block<select name="blockId" required defaultValue=""><option disabled value="">Select block</option>{document.blocks.filter((block) => block.visible).map((block) => <option key={block.id} value={block.id}>{block.type} · {block.id.slice(-6)}</option>)}</select></label><label>Instruction<textarea name="instruction" rows={3} placeholder="Make the hero clearer for TikTok traffic without adding new claims." required/></label><button type="submit" disabled={!configured}>Generate rewrite</button></form>
        <form className="settings-card" action={runPageAi}><input type="hidden" name="pageId" value={id}/><input type="hidden" name="action" value="generate_variants"/><h2>Copy variants</h2><label>Direction<textarea name="direction" rows={3} placeholder="Test career outcome vs ease/convenience."/></label><button type="submit" disabled={!configured}>Generate 2–3 variants</button></form>
        <form className="settings-card" action={runPageAi}><input type="hidden" name="pageId" value={id}/><input type="hidden" name="action" value="suggest_seo"/><h2>SEO/social copy</h2><p>Suggest metadata from the current validated page copy.</p><button type="submit" disabled={!configured}>Suggest SEO</button></form>
        <form className="settings-card" action={runPageAi}><input type="hidden" name="pageId" value={id}/><input type="hidden" name="action" value="suggest_faq"/><h2>FAQ</h2><p>Generate grounded answers from current page/campaign context.</p><button type="submit" disabled={!configured}>Suggest FAQ</button></form>
        <form className="settings-card" action={runPageAi}><input type="hidden" name="pageId" value={id}/><input type="hidden" name="action" value="quality_check"/><h2>Pre-publish quality</h2><p>Deterministic schema, CTA, metadata, accessibility and conversion checks. No external model required.</p><button type="submit">Run quality check</button></form>
      </div>
      {!configured ? <div className="ai-notice ai-warning">Model-assisted actions are disabled until provider credentials/model are configured. Quality checks and all manual editing remain available.</div> : null}

      <section className="ai-results"><h2>Suggestions & checks</h2>{jobs.length === 0 ? <p>No AI jobs for this page yet.</p> : jobs.map((job) => <JobResult key={job.id} job={job} pageId={id}/>)}</section>
    </main>;
  } finally { await client.end(); }
}
