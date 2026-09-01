import Link from "next/link";
import { formatRate, percentageChange } from "@growth-os/analytics";
import { getDatabase } from "@growth-os/db";
import { getAnalyticsReport } from "@/lib/analytics-report";
import { requirePermission } from "@/lib/user-access";
import styles from "./analytics.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Option = { id: string; label: string };
type CreativeOption = { id: string };
type PlatformOption = { platform: string };

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function parseUtcDay(value: string, fallback: Date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function changeText(current: number, previous: number) {
  const change = percentageChange(current, previous);
  if (change === null) return "New";
  if (change === 0) return "0.0%";
  return `${change > 0 ? "+" : ""}${(change * 100).toFixed(1)}%`;
}

function metric(label: string, value: string | number, current: number, previous: number, detail?: string) {
  return <article className={styles.metric} key={label}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{changeText(current, previous)} vs prior period{detail ? ` · ${detail}` : ""}</small>
  </article>;
}

function money(value: number, currency: string) {
  if (currency === "UNSPECIFIED") return value.toLocaleString("en-PK", { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
  }
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("analytics:view");
  const params = await searchParams;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultFrom = new Date(todayUtc.getTime() - 29 * 86_400_000);
  const from = parseUtcDay(one(params.from), defaultFrom);
  const inclusiveTo = parseUtcDay(one(params.to), todayUtc);
  const to = new Date(inclusiveTo.getTime() + 86_400_000);
  const filters = {
    from,
    to,
    brandId: one(params.brand) || null,
    campaignId: one(params.campaign) || null,
    pageId: one(params.page) || null,
    variantId: one(params.variant) || null,
    creativeId: one(params.creative) || null,
    platform: one(params.platform) || null
  };

  const { client } = getDatabase();
  let brandOptions: Option[] = [];
  let campaignOptions: Option[] = [];
  let pageOptions: Option[] = [];
  let variantOptions: Option[] = [];
  let creativeOptions: CreativeOption[] = [];
  let platformOptions: PlatformOption[] = [];
  try {
    [brandOptions, campaignOptions, pageOptions, variantOptions, creativeOptions, platformOptions] = await Promise.all([
      client<Option[]>`SELECT id::text AS id, name AS label FROM brands WHERE status='active' ORDER BY name`,
      client<Option[]>`SELECT id::text AS id, name AS label FROM campaigns WHERE status <> 'archived' ORDER BY updated_at DESC`,
      client<Option[]>`SELECT id::text AS id, name AS label FROM landing_pages WHERE status='draft' ORDER BY updated_at DESC`,
      client<Option[]>`SELECT id::text AS id, name AS label FROM variants ORDER BY created_at DESC`,
      client<CreativeOption[]>`SELECT DISTINCT creative_id AS id FROM analytics_events WHERE creative_id IS NOT NULL ORDER BY creative_id LIMIT 100`,
      client<PlatformOption[]>`SELECT DISTINCT platform FROM campaigns WHERE platform <> '' ORDER BY platform`
    ]);
  } finally {
    await client.end();
  }

  const report = await getAnalyticsReport(filters);
  const c = report.current;
  const p = report.previous;
  const onlyCurrency = report.currencies.length === 1 ? report.currencies[0] : null;
  const hasData = c.landingViews > 0 || c.signupCompletes > 0 || c.purchases > 0 || c.subscriptions > 0;
  const levels = ["brand", "campaign", "page", "variant", "creative"] as const;

  return <main className="shell compact-shell">
    <section className="section-heading">
      <p className="eyebrow">Growth analytics</p>
      <h1>See what is converting across the portfolio.</h1>
      <p>UTC reporting with one consistent funnel: CTA rate = CTA clicks ÷ landing views; subscription conversion = subscriptions ÷ unique landing sessions. Revenue is only presented as a combined KPI when the filtered result has one currency.</p>
    </section>

    <form className={styles.filters} action="/analytics">
      <label>From (UTC)<input type="date" name="from" defaultValue={isoDay(from)} /></label>
      <label>To (UTC)<input type="date" name="to" defaultValue={isoDay(inclusiveTo)} /></label>
      <label>Brand<select name="brand" defaultValue={filters.brandId ?? ""}><option value="">All brands</option>{brandOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>Platform<select name="platform" defaultValue={filters.platform ?? ""}><option value="">All platforms</option>{platformOptions.map((option) => <option key={option.platform} value={option.platform}>{option.platform}</option>)}</select></label>
      <label>Campaign<select name="campaign" defaultValue={filters.campaignId ?? ""}><option value="">All campaigns</option>{campaignOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>Page<select name="page" defaultValue={filters.pageId ?? ""}><option value="">All pages</option>{pageOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>Variant<select name="variant" defaultValue={filters.variantId ?? ""}><option value="">All variants</option>{variantOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>Creative<select name="creative" defaultValue={filters.creativeId ?? ""}><option value="">All creatives</option>{creativeOptions.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}</select></label>
      <div className={styles.filterActions}><button className="primary-button" type="submit">Apply</button><Link href="/analytics">Reset</Link></div>
    </form>

    {!hasData ? <section className={styles.empty}>
      <strong>No acquisition data for this filter.</strong>
      <span>Publish a tracked page or widen the date/filter range. Zero values are not hidden or inferred.</span>
    </section> : <>
      <section className={styles.metrics} aria-label="Current period metrics">
        {metric("Landing views", c.landingViews.toLocaleString("en-PK"), c.landingViews, p.landingViews)}
        {metric("Unique sessions", c.uniqueSessions.toLocaleString("en-PK"), c.uniqueSessions, p.uniqueSessions)}
        {metric("CTA rate", formatRate(c.ctaRate), c.ctaRate, p.ctaRate, `${c.ctaClicks.toLocaleString("en-PK")} clicks`)}
        {metric("Signup completions", c.signupCompletes.toLocaleString("en-PK"), c.signupCompletes, p.signupCompletes)}
        {metric("Checkout starts", c.checkoutStarts.toLocaleString("en-PK"), c.checkoutStarts, p.checkoutStarts)}
        {metric("Subscriptions", c.subscriptions.toLocaleString("en-PK"), c.subscriptions, p.subscriptions)}
        {metric("Subscription CVR", formatRate(c.subscriptionConversionRate), c.subscriptionConversionRate, p.subscriptionConversionRate)}
        {metric("Revenue", onlyCurrency ? money(onlyCurrency.revenue, onlyCurrency.currency) : report.currencies.length > 1 ? "Mixed currencies" : "—", onlyCurrency?.revenue ?? 0, report.currencies.length === 1 ? p.revenue : 0)}
        {metric("Revenue / visitor", onlyCurrency ? money(c.revenuePerVisitor, onlyCurrency.currency) : "—", onlyCurrency ? c.revenuePerVisitor : 0, onlyCurrency ? p.revenuePerVisitor : 0)}
      </section>

      {report.currencies.length > 0 && <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span>Revenue/value</span><h2>Currency-safe totals</h2></div><small>Never adds different currencies into one financial KPI.</small></div>
        <div className={styles.currencyGrid}>{report.currencies.map((row) => <article key={row.currency}><span>{row.currency}</span><strong>{money(row.revenue, row.currency)}</strong><small>{row.conversions} valued conversions</small></article>)}</div>
      </section>}

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span>Funnel</span><h2>Observed conversion path</h2></div><small>{isoDay(from)} through {isoDay(inclusiveTo)} UTC</small></div>
        <div className={styles.funnel}>
          {[ ["Landing", c.landingViews], ["CTA clicks", c.ctaClicks], ["Signup starts", c.signupStarts], ["Signup complete", c.signupCompletes], ["Checkout", c.checkoutStarts], ["Purchases", c.purchases], ["Subscriptions", c.subscriptions] ].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{Number(value).toLocaleString("en-PK")}</strong></div>)}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span>Breakdowns</span><h2>Portfolio → creative performance</h2></div><small>Observed counts; no significance claims.</small></div>
        <div className={styles.breakdowns}>{levels.map((level) => {
          const rows = report.breakdown.filter((row) => row.level === level);
          if (!rows.length) return null;
          return <section key={level} className={styles.breakdown}>
            <h3>{level[0]?.toUpperCase()}{level.slice(1)}</h3>
            <div className={styles.table} role="table" aria-label={`${level} analytics`}>
              <div className={`${styles.row} ${styles.header}`}><span>Name</span><span>Views</span><span>Sessions</span><span>CTA rate</span><span>Subscriptions</span><span>{onlyCurrency ? `Revenue (${onlyCurrency.currency})` : "Value"}</span></div>
              {rows.map((row) => <div className={styles.row} key={`${row.level}:${row.key}`}><strong title={row.key}>{row.label}</strong><span>{row.landingViews.toLocaleString("en-PK")}</span><span>{row.uniqueSessions.toLocaleString("en-PK")}</span><span>{formatRate(row.landingViews ? row.ctaClicks / row.landingViews : 0)}</span><span>{row.subscriptions.toLocaleString("en-PK")}</span><span>{onlyCurrency ? money(row.revenue, onlyCurrency.currency) : row.revenue ? "Mixed / filter currency" : "—"}</span></div>)}
            </div>
          </section>;
        })}</div>
      </section>

      <section className={styles.attributionGrid}>
        {(["first", "last"] as const).map((touch) => <section className={styles.panel} key={touch}>
          <div className={styles.panelHeading}><div><span>{touch}-touch</span><h2>Attribution by source</h2></div></div>
          <div className={styles.sourceList}>{report.attribution.filter((row) => row.touch === touch).map((row) => <div key={`${touch}:${row.source}`}><strong>{row.source}</strong><span>{row.conversions} conversions</span><span>{onlyCurrency ? money(row.revenue, onlyCurrency.currency) : row.revenue ? "Value across currencies" : "—"}</span></div>)}</div>
        </section>)}
      </section>
    </>}

    <p className={styles.definition}>Current period uses an inclusive UTC start day and inclusive UTC end day; SQL uses an exclusive next-day boundary. The comparison period is the immediately preceding equivalent duration. Events and conversions remain stored in UTC.</p>
  </main>;
}
