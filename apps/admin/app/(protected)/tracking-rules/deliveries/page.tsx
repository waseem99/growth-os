import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  brands, conversionProviderDeliveries, getDatabase
} from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";

export default async function ProviderDeliveryDiagnostics() {
  await requirePermission("integrations:manage");
  const { db, client } = getDatabase();
  try {
    const [counts, rows] = await Promise.all([
      db.select({
        status: conversionProviderDeliveries.status,
        count: sql<number>`count(*)::int`
      }).from(conversionProviderDeliveries).groupBy(conversionProviderDeliveries.status),
      db.select({
        id: conversionProviderDeliveries.id,
        brandName: brands.name,
        provider: conversionProviderDeliveries.provider,
        providerEvent: conversionProviderDeliveries.providerEvent,
        providerEventId: conversionProviderDeliveries.providerEventId,
        status: conversionProviderDeliveries.status,
        attemptCount: conversionProviderDeliveries.attemptCount,
        createdAt: conversionProviderDeliveries.createdAt,
        deliveredAt: conversionProviderDeliveries.deliveredAt
      }).from(conversionProviderDeliveries)
        .innerJoin(brands, eq(brands.id, conversionProviderDeliveries.brandId))
        .orderBy(desc(conversionProviderDeliveries.createdAt)).limit(100)
    ]);
    const total = counts.reduce((sum, count) => sum + count.count, 0);
    return <main className="shell compact-shell">
      <section className="section-heading">
        <p className="eyebrow">Conversion provider deliveries</p>
        <h1>Delivery evidence — not payment confirmation.</h1>
        <p>This is the server-side provider outbox. Pending records are queued delivery intents, not receipts from Meta or TikTok. Provider transport remains disabled until the connected product, provider credentials and staging UAT are approved.</p>
        <Link href="/tracking-rules">Back to Conversion Rules</Link>
      </section>
      <section className="settings-card" style={{ marginTop: 24 }}>
        <strong>{total} total provider delivery records</strong>
        <p>{counts.length ? counts.map((row) => `${row.status}: ${row.count}`).join(" · ") : "No queued provider events"}</p>
      </section>
      <section className="settings-card" style={{ marginTop: 24, overflowX: "auto" }}>
        <table>
          <thead><tr><th>Product</th><th>Provider</th><th>Provider event</th><th>Status</th><th>Attempts</th><th>Created</th><th>Delivered</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7}>No provider delivery intents. Successful, consent-confirmed product callbacks are needed first.</td></tr>}
            {rows.map((row) => <tr key={row.id}>
              <td>{row.brandName}</td>
              <td>{row.provider}</td>
              <td>{row.providerEvent}</td>
              <td>{row.status}</td>
              <td>{row.attemptCount}</td>
              <td>{row.createdAt.toLocaleString("en-PK")}</td>
              <td>{row.deliveredAt?.toLocaleString("en-PK") ?? "Not delivered"}</td>
            </tr>)}
          </tbody>
        </table>
      </section>
    </main>;
  } finally { await client.end(); }
}
