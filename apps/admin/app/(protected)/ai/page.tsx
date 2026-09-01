import { desc, eq } from "drizzle-orm";
import { aiJobs, brands, campaigns, getDatabase } from "@growth-os/db";
import { providerFromEnv } from "@growth-os/ai";
import { requirePermission } from "@/lib/user-access";
import { generateAiPageDraft } from "./actions";

export default async function AiWorkspace({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission("ai:use");
  const { error } = await searchParams;
  const { db, client } = getDatabase();
  try {
    const [brandRows, campaignRows, recent] = await Promise.all([
      db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, "active")),
      db.select({ id: campaigns.id, brandId: campaigns.brandId, name: campaigns.name, platform: campaigns.platform }).from(campaigns),
      db.select({ id: aiJobs.id, action: aiJobs.action, status: aiJobs.status, provider: aiJobs.provider, model: aiJobs.model, error: aiJobs.error, createdAt: aiJobs.createdAt, targetId: aiJobs.targetId }).from(aiJobs).orderBy(desc(aiJobs.createdAt)).limit(12)
    ]);
    const configured = Boolean(providerFromEnv());
    return <main className="shell compact-shell">
      <section className="section-heading">
        <p className="eyebrow">AI authoring</p>
        <h1>Generate a controlled landing-page draft</h1>
        <p>AI writes structured marketing copy only. GrowthOS composes and validates the real page schema; nothing is published automatically.</p>
      </section>
      {error ? <div className="ai-notice ai-error">{decodeURIComponent(error)}</div> : null}
      <div className={`ai-notice ${configured ? "ai-ready" : "ai-warning"}`}><strong>{configured ? "Provider ready" : "Provider not configured"}</strong><span>{configured ? "Generation will use the server-configured provider/model." : "Manual creation/editing remains fully available. Configure AI_PROVIDER, OPENAI_API_KEY and OPENAI_MODEL in the deployment environment to enable generation."}</span></div>

      <form className="settings-card ai-brief-form" action={generateAiPageDraft}>
        <div className="ai-form-grid">
          <label>Brand<select name="brandId" required defaultValue=""><option disabled value="">Select brand</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label>Campaign (optional)<select name="campaignId" defaultValue=""><option value="">No campaign</option>{campaignRows.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.platform}</option>)}</select></label>
          <label>Product name<input name="productName" placeholder="SkillUp" required /></label>
          <label>Channel / platform<input name="platform" placeholder="TikTok" /></label>
          <label>Template<select name="templateKey" defaultValue="subscription-acquisition"><option value="subscription-acquisition">Subscription Acquisition</option><option value="content-acquisition">Content Acquisition</option><option value="game-acquisition">Game Acquisition</option></select></label>
          <label>Style<select name="stylePreset" defaultValue="clean-light"><option value="clean-light">Clean light</option><option value="premium-purple">Premium purple</option><option value="campaign-dark">Campaign dark</option><option value="promotion">Promotion</option><option value="minimal">Minimal</option></select></label>
          <label>Conversion goal<input name="conversionGoal" defaultValue="subscription_started" /></label>
          <label>Locale<input name="locale" defaultValue="en-PK" /></label>
          <label className="ai-wide">Audience<textarea name="audience" required rows={3} placeholder="Who is this campaign for?" /></label>
          <label className="ai-wide">Offer / product facts<textarea name="offer" required rows={4} placeholder="Only facts the AI is allowed to use: pricing, trial, reward, eligibility, etc." /></label>
          <label className="ai-wide">Positioning<textarea name="positioning" required rows={3} placeholder="The main angle/value proposition to lead with" /></label>
          <label>Tone<input name="tone" defaultValue="clear, energetic and credible" /></label>
          <label>Preferred slug<input name="slug" placeholder="campaign-name" /></label>
        </div>
        <button className="primary-button" type="submit" disabled={!configured}>Generate validated draft</button>
        <small>Generation creates a normal editable draft. The editor must still review, preview and explicitly publish it.</small>
      </form>

      <section className="ai-recent">
        <h2>Recent AI jobs</h2>
        {recent.length === 0 ? <p>No AI jobs yet.</p> : <div className="table-list">{recent.map((job) => <div className="ai-job-row" key={job.id}><div><strong>{job.action.replaceAll("_", " ")}</strong><span>{job.provider || "pending"}{job.model ? ` · ${job.model}` : ""}</span></div><span className={`ai-status ai-${job.status}`}>{job.status}</span><small>{job.createdAt.toISOString()}</small>{job.error ? <small title={job.error}>Failure recorded</small> : null}</div>)}</div>}
      </section>
    </main>;
  } finally { await client.end(); }
}
