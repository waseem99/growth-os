import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { analyticsEvents, brands, conversions, getDatabase, landingVariations } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";

export default async function VariationResultsPage() {
  await requirePermission("analytics:view");
  const { db, client } = getDatabase();
  try {
    const [variationRows, eventRows, conversionRows] = await Promise.all([
      db.select({ id: landingVariations.id, brandId: landingVariations.brandId, parameter: landingVariations.parameterKey,
        brandName: brands.name })
        .from(landingVariations).innerJoin(brands, eq(brands.id, landingVariations.brandId)),
      db.select({
        brandId: analyticsEvents.brandId,
        variationId: sql<string>`${analyticsEvents.properties}->>'variationId'`,
        packageCode: sql<string | null>`${analyticsEvents.properties}->>'packageCode'`,
        source: analyticsEvents.source,
        views: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'landing_view')::int`,
        clicks: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'cta_click')::int`,
        checkoutStarts: sql<number>`count(*) filter (where ${analyticsEvents.eventName} = 'checkout_start')::int`
      }).from(analyticsEvents)
        .where(sql`${analyticsEvents.occurredAt} >= now() - interval '30 days'
          AND ${analyticsEvents.properties}->>'variationId' IS NOT NULL`)
        .groupBy(analyticsEvents.brandId, sql`${analyticsEvents.properties}->>'variationId'`,
          sql`${analyticsEvents.properties}->>'packageCode'`, analyticsEvents.source),
      db.select({
        brandId: conversions.brandId,
        variationId: sql<string>`${conversions.properties}->>'variationId'`,
        packageCode: sql<string | null>`${conversions.properties}->>'packageCode'`,
        source: sql<string | null>`${conversions.attribution}->'lastTouch'->>'source'`,
        converted: sql<number>`count(*)::int`
      }).from(conversions)
        .where(sql`${conversions.occurredAt} >= now() - interval '30 days'
          AND ${conversions.properties}->>'variationId' IS NOT NULL
          AND coalesce(${conversions.properties}->>'testTraffic', 'false') <> 'true'`)
        .groupBy(conversions.brandId, sql`${conversions.properties}->>'variationId'`,
          sql`${conversions.properties}->>'packageCode'`,
          sql`${conversions.attribution}->'lastTouch'->>'source'`)
    ]);
    const details = new Map(variationRows.map((variation) => [variation.id, variation]));
    const key = (brandId: string | null, variationId: string | null, pkg: string | null, source: string | null) =>
      `${brandId ?? ""}|${variationId ?? ""}|${pkg ?? ""}|${source ?? ""}`;
    const converted = new Map(conversionRows.map((row) => [key(row.brandId, row.variationId, row.packageCode, row.source), row.converted]));
    const metrics = eventRows
      .filter((row) => details.has(row.variationId) && details.get(row.variationId)?.brandId === row.brandId)
      .map((row) => ({ ...row, variation: details.get(row.variationId)!,
        conversions: converted.get(key(row.brandId, row.variationId, row.packageCode, row.source)) ?? 0 }));
    return <main className="shell compact-shell">
      <section className="section-heading">
        <p className="eyebrow">Dynamic campaign performance</p>
        <h1>Variations · last 30 days</h1>
        <p>First-party event counts grouped by product, banner, package and source. Confirmed conversions appear only when the downstream product backend relays variation/package attribution; zero conversions can mean a missing callback, not necessarily zero sales.</p>
        <Link href="/analytics">Back to Results</Link> · <Link href="/variations">Manage variations</Link>
      </section>
      <section className="settings-card" style={{ marginTop: 24 }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Product</th><th>Variation</th><th>Package</th><th>Source</th><th>Views</th><th>CTA clicks</th><th>Checkout starts</th><th>Confirmed conversions</th></tr></thead>
            <tbody>
              {metrics.length === 0 ? <tr><td colSpan={8}>No measured variation traffic yet. Publish a variation, complete consent where required and test a generated campaign link.</td></tr> : null}
              {metrics.map((item) => <tr key={key(item.brandId, item.variationId, item.packageCode, item.source)}>
                <td>{item.variation.brandName}</td><td><code>{item.variation.parameter}</code></td>
                <td>{item.packageCode ?? "default"}</td><td>{item.source ?? "unknown"}</td>
                <td>{item.views}</td><td>{item.clicks}</td><td>{item.checkoutStarts}</td><td>{item.conversions}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </main>;
  } finally { await client.end(); }
}
