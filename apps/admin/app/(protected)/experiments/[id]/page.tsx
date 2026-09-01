import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRate } from "@growth-os/analytics";
import { getDatabase } from "@growth-os/db";
import { hasPermission } from "@/lib/authz";
import { getAnalyticsReport } from "@/lib/analytics-report";
import { requirePermission } from "@/lib/user-access";
import { addExperimentVariant, removeExperimentVariant, saveExperimentAllocation, updateExperimentStatus } from "../actions";
import styles from "../experiments.module.css";

type ExperimentRow = { id: string; name: string; status: "draft" | "running" | "paused" | "ended"; page_id: string; page_name: string; page_slug: string; campaign_id: string | null; campaign_name: string | null; hostname: string | null; starts_at: Date | null; ends_at: Date | null };
type VariantRow = { id: string; name: string; allocation: number; is_control: boolean; page_version_id: string; version_number: number };
type VersionRow = { id: string; version_number: number; publish_note: string | null; created_at: Date };

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`; }
}

export default async function ExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("analytics:view");
  const canManage = hasPermission(user.role, "campaigns:manage");
  const { id } = await params;
  const { client } = getDatabase();
  let experiment: ExperimentRow | undefined;
  let variants: VariantRow[] = [];
  let versions: VersionRow[] = [];
  try {
    [experiment] = await client<ExperimentRow[]>`
      SELECT e.id::text AS id, e.name, e.status, e.page_id::text AS page_id, lp.name AS page_name, lp.slug AS page_slug,
        e.campaign_id::text AS campaign_id, c.name AS campaign_name, d.hostname, e.starts_at, e.ends_at
      FROM experiments e JOIN landing_pages lp ON lp.id=e.page_id LEFT JOIN campaigns c ON c.id=e.campaign_id LEFT JOIN domains d ON d.id=lp.domain_id
      WHERE e.id=${id}::uuid LIMIT 1`;
    if (!experiment) notFound();
    [variants, versions] = await Promise.all([
      client<VariantRow[]>`SELECT v.id::text AS id, v.name, v.allocation, v.is_control, v.page_version_id::text AS page_version_id, pv.version_number FROM variants v JOIN page_versions pv ON pv.id=v.page_version_id WHERE v.experiment_id=${id}::uuid ORDER BY v.created_at`,
      client<VersionRow[]>`SELECT id::text AS id, version_number, publish_note, created_at FROM page_versions WHERE page_id=${experiment.page_id}::uuid ORDER BY version_number DESC`
    ]);
  } finally { await client.end(); }

  const now = new Date();
  const from = experiment.starts_at ?? new Date(now.getTime() - 30 * 86_400_000);
  const report = await getAnalyticsReport({ from, to: now, pageId: experiment.page_id, campaignId: experiment.campaign_id });
  const variantIds = new Set(variants.map((variant) => variant.id));
  const observed = report.breakdown.filter((row) => row.level === "variant" && variantIds.has(row.key));
  const observedById = new Map(observed.map((row) => [row.key, row]));
  const currency = report.currencies.length === 1 ? report.currencies[0]!.currency : null;
  const origin = experiment.hostname ? `${experiment.hostname.endsWith(".localhost") || experiment.hostname === "localhost" ? "http" : "https"}://${experiment.hostname}` : null;

  return <main className="shell compact-shell">
    <section className="section-heading"><p className="eyebrow">Experiment</p><h1>{experiment.name}</h1><p>{experiment.page_name}{experiment.campaign_name ? ` · ${experiment.campaign_name}` : ""}. Status: <strong>{experiment.status}</strong>.</p></section>
    <div className={styles.detailGrid}>
      <section className={styles.panel}>
        <h2>Variants</h2><p>Variants point to immutable page versions. Allocation is locked after the first start so observed results keep a stable meaning.</p>
        <div className={styles.meta}><div><span>Page</span><strong>{experiment.page_name}</strong></div><div><span>Campaign</span><strong>{experiment.campaign_name ?? "No campaign"}</strong></div><div><span>Started</span><strong>{experiment.starts_at ? `${experiment.starts_at.toLocaleString("en-PK", { timeZone: "UTC" })} UTC` : "Not started"}</strong></div><div><span>Ended</span><strong>{experiment.ends_at ? `${experiment.ends_at.toLocaleString("en-PK", { timeZone: "UTC" })} UTC` : "—"}</strong></div></div>

        {canManage && experiment.status === "draft" && <form className={styles.variantForm} action={addExperimentVariant}>
          <input type="hidden" name="experimentId" value={experiment.id} />
          <input name="name" required maxLength={120} placeholder="Variant name" />
          <select name="pageVersionId" required defaultValue=""><option value="" disabled>Page version</option>{versions.map((version) => <option key={version.id} value={version.id}>v{version.version_number}{version.publish_note ? ` · ${version.publish_note}` : ""}</option>)}</select>
          <input name="allocation" type="number" min={0} max={100} step={1} defaultValue={variants.length ? 0 : 100} aria-label="Allocation percent" />
          <label><input name="isControl" type="checkbox" defaultChecked={variants.length === 0} /> Control</label>
          <button type="submit">Add</button>
        </form>}

        <div className={styles.variants}>{variants.map((variant) => <div className={styles.variant} key={variant.id}>
          <div><strong>{variant.name}{variant.is_control ? " · Control" : ""}</strong><code>{variant.id}</code></div><span>v{variant.version_number}</span><span>{variant.allocation}%</span>
          {canManage && experiment.status === "draft" ? <form action={removeExperimentVariant}><input type="hidden" name="experimentId" value={experiment.id} /><input type="hidden" name="variantId" value={variant.id} /><button type="submit">Remove</button></form> : <span />}
        </div>)}</div>

        {canManage && experiment.status === "draft" && variants.length >= 2 && <form className={styles.allocation} action={saveExperimentAllocation}>
          <input type="hidden" name="experimentId" value={experiment.id} />
          {variants.map((variant) => <div className={styles.allocationRow} key={variant.id}><strong>{variant.name}</strong><input name={`allocation:${variant.id}`} type="number" min={0} max={100} step={1} defaultValue={variant.allocation} /><label><input type="radio" name="controlId" value={variant.id} defaultChecked={variant.is_control} required /> Control</label></div>)}
          <button className="primary-button" type="submit">Save 100% allocation</button>
        </form>}
      </section>

      <aside className={styles.panel}>
        <h2>Run control</h2><p>Only one experiment can run on a page. Paused or ended experiments fall back to the page’s current published version.</p>
        <div className={styles.actions}>
          {canManage && (experiment.status === "draft" || experiment.status === "paused") && <form action={updateExperimentStatus}><input type="hidden" name="experimentId" value={experiment.id} /><input type="hidden" name="action" value="start" /><button className="primary-button" type="submit">{experiment.status === "paused" ? "Resume" : "Start"}</button></form>}
          {canManage && experiment.status === "running" && <form action={updateExperimentStatus}><input type="hidden" name="experimentId" value={experiment.id} /><input type="hidden" name="action" value="pause" /><button type="submit">Pause</button></form>}
          {canManage && (experiment.status === "running" || experiment.status === "paused") && <form action={updateExperimentStatus}><input type="hidden" name="experimentId" value={experiment.id} /><input type="hidden" name="action" value="end" /><button type="submit">End</button></form>}
          <Link href={`/analytics?page=${experiment.page_id}`}>Open full analytics</Link>
        </div>
        {origin && variants.length > 0 && <><h2 style={{ marginTop: 24 }}>Test links</h2><p>Forced variant links are marked test traffic and noindex; their events are excluded from production analytics.</p><div className={styles.actions}>{variants.map((variant) => <a key={variant.id} target="_blank" rel="noreferrer" href={`${origin}/${experiment.page_slug}?go_test=1&go_variant=${variant.id}`}>Preview {variant.name} ↗</a>)}</div></>}
      </aside>
    </div>

    <section className={`${styles.panel} ${styles.report}`}>
      <h2>Observed variant results</h2><p>Counts and rates only. No statistical-significance claim or autonomous allocation change is made in P0.</p>
      <div className={styles.reportRow}><span>Variant</span><span>Views</span><span>Sessions</span><span>CTA rate</span><span>Subs</span><span>{currency ? `Value (${currency})` : "Value"}</span></div>
      {variants.map((variant) => {
        const row = observedById.get(variant.id);
        const views = row?.landingViews ?? 0; const sessions = row?.uniqueSessions ?? 0; const clicks = row?.ctaClicks ?? 0; const subscriptions = row?.subscriptions ?? 0; const revenue = row?.revenue ?? 0;
        return <div className={styles.reportRow} key={variant.id}><strong>{variant.name}{variant.is_control ? " · Control" : ""}</strong><span>{views}</span><span>{sessions}</span><span>{formatRate(views ? clicks / views : 0)}</span><span>{subscriptions} · {formatRate(sessions ? subscriptions / sessions : 0)}</span><span>{currency ? money(revenue, currency) : revenue ? "Mixed currencies" : "—"}</span></div>;
      })}
    </section>
  </main>;
}
