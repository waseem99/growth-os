import Link from "next/link";
import { getDatabase } from "@growth-os/db";
import { hasPermission } from "@/lib/authz";
import { requirePermission } from "@/lib/user-access";
import { createExperiment } from "./actions";
import styles from "./experiments.module.css";

type PageOption = { id: string; label: string; brand_name: string; campaign_name: string | null; versions: string };
type ExperimentRow = { id: string; name: string; status: string; page_name: string; campaign_name: string | null; starts_at: Date | null; ends_at: Date | null; variants: string };

export default async function ExperimentsPage() {
  const user = await requirePermission("analytics:view");
  const canManage = hasPermission(user.role, "campaigns:manage");
  const { client } = getDatabase();
  try {
    const [pages, experiments] = await Promise.all([
      client<PageOption[]>`
        SELECT lp.id::text AS id, lp.name AS label, b.name AS brand_name, c.name AS campaign_name, count(pv.id)::text AS versions
        FROM landing_pages lp
        JOIN brands b ON b.id=lp.brand_id
        LEFT JOIN campaigns c ON c.id=lp.campaign_id
        JOIN page_versions pv ON pv.page_id=lp.id
        WHERE lp.status='draft'
        GROUP BY lp.id, lp.name, b.name, c.name
        HAVING count(pv.id) >= 1
        ORDER BY b.name, lp.name`,
      client<ExperimentRow[]>`
        SELECT e.id::text AS id, e.name, e.status, lp.name AS page_name, c.name AS campaign_name, e.starts_at, e.ends_at, count(v.id)::text AS variants
        FROM experiments e
        JOIN landing_pages lp ON lp.id=e.page_id
        LEFT JOIN campaigns c ON c.id=e.campaign_id
        LEFT JOIN variants v ON v.experiment_id=e.id
        GROUP BY e.id, e.name, e.status, lp.name, c.name, e.starts_at, e.ends_at
        ORDER BY e.updated_at DESC`
    ]);
    return <main className="shell compact-shell">
      <section className="section-heading"><p className="eyebrow">Experiments</p><h1>Test page versions without splitting campaign infrastructure.</h1><p>One canonical URL, immutable page-version variants, sticky first-party assignment and observed results only—no automatic traffic shifting.</p></section>
      {canManage && <form className={styles.create} action={createExperiment}>
        <input name="name" required maxLength={160} placeholder="Experiment name" />
        <select name="pageId" required defaultValue=""><option value="" disabled>Landing page</option>{pages.map((page) => <option value={page.id} key={page.id}>{page.brand_name} · {page.label} · {page.versions} version(s){page.campaign_name ? ` · ${page.campaign_name}` : ""}</option>)}</select>
        <button className="primary-button" type="submit">Create experiment</button>
      </form>}
      <div className={styles.list}>
        {experiments.length === 0 && <div className={styles.empty}>No experiments yet.</div>}
        {experiments.map((experiment) => <Link className={styles.row} href={`/experiments/${experiment.id}`} key={experiment.id}>
          <div><strong>{experiment.name}</strong><span>{experiment.page_name}{experiment.campaign_name ? ` · ${experiment.campaign_name}` : ""}</span></div>
          <span className={styles.status}>{experiment.status}</span>
          <span>{experiment.variants} variants</span>
          <span>{experiment.starts_at ? `Started ${experiment.starts_at.toLocaleString("en-PK", { timeZone: "UTC" })} UTC` : "Not started"}</span>
        </Link>)}
      </div>
    </main>;
  } finally { await client.end(); }
}
