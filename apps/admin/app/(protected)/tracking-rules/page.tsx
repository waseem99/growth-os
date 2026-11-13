import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { brands, conversionEventRules, getDatabase, productPackages } from "@growth-os/db";
import { CONVERSION_PROVIDER_EVENTS } from "@growth-os/tracking";
import { requirePermission } from "@/lib/user-access";
import { saveConversionEventRule } from "./actions";

export default async function TrackingRulesPage() {
  await requirePermission("integrations:manage");
  const { db, client } = getDatabase();
  try {
    const [brandRows, packageRows, ruleRows] = await Promise.all([
      db.select({ id: brands.id, name: brands.name }).from(brands)
        .where(eq(brands.status, "active")).orderBy(brands.name),
      db.select({ id: productPackages.id, code: productPackages.packageCode,
        brandId: productPackages.brandId, status: productPackages.status })
        .from(productPackages).orderBy(productPackages.packageCode),
      db.select({ id: conversionEventRules.id, brandId: conversionEventRules.brandId,
        packageId: conversionEventRules.packageId, provider: conversionEventRules.provider,
        canonicalEvent: conversionEventRules.canonicalEvent, providerEvent: conversionEventRules.providerEvent,
        status: conversionEventRules.status
      }).from(conversionEventRules).orderBy(desc(conversionEventRules.updatedAt))
    ]);
    const brandName = new Map(brandRows.map((brand) => [brand.id, brand.name]));
    const packageName = new Map(packageRows.map((pkg) => [pkg.id, pkg.code]));
    return <main className="shell compact-shell">
      <section className="section-heading">
        <p className="eyebrow">Conversion event rules</p>
        <h1>Map each product and package to a tracking event.</h1>
        <p>Approved standard events for Meta and TikTok, independently scoped by product and package. Successful provider receipts are separate from backend-confirmed conversions.</p>
        <Link href="/tracking-rules/deliveries">View provider delivery diagnostics</Link>
      </section>
      <section className="settings-card" style={{ marginTop: 24 }}>
        <h2>New or updated event mapping</h2>
        <form action={saveConversionEventRule}>
          <div className="asset-upload-grid">
            <label>Product<select name="brandId" required defaultValue=""><option value="" disabled>Choose product</option>
              {brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select></label>
            <label>Package<select name="packageId" defaultValue=""><option value="">Product default (all packages)</option>
              {packageRows.map((pkg) => <option key={pkg.id} value={pkg.id}>
                {brandName.get(pkg.brandId) ?? pkg.brandId} · {pkg.code} ({pkg.status})
              </option>)}
            </select></label>
            <label>Ad provider<select name="provider" defaultValue="meta">
              {Object.keys(CONVERSION_PROVIDER_EVENTS).map((provider) => <option key={provider} value={provider}>{provider === "meta" ? "Meta" : "TikTok"}</option>)}
            </select></label>
            <label>Confirmed event<select name="canonicalEvent" defaultValue="subscription_started">
              <option value="signup_complete">Completed registration</option>
              <option value="subscription_started">Subscription started</option>
              <option value="purchase">Purchase completed</option>
            </select></label>
            <label>Rule state<select name="status" defaultValue="disabled">
              <option value="disabled">Disabled</option><option value="enabled">Enabled (configuration)</option>
            </select></label>
          </div>
          <p>The provider-specific event name is selected automatically: Meta Subscribe/Purchase and TikTok Subscribe/CompletePayment. No live payment or event delivery occurs from this screen.</p>
          <button type="submit" className="primary-button">Save event mapping</button>
        </form>
      </section>
      <section className="table-list" style={{ marginTop: 24 }}>
        {ruleRows.length === 0 && <p className="empty-state">No event mappings yet. Configure a product above.</p>}
        {ruleRows.map((rule) => <section className="settings-card" key={rule.id}>
          <strong>{brandName.get(rule.brandId) ?? rule.brandId}</strong>
          <p>{rule.packageId ? `Package ${packageName.get(rule.packageId) ?? rule.packageId}` : "All packages"} · {rule.provider} · {rule.canonicalEvent} → {rule.providerEvent} · {rule.status}</p>
        </section>)}
      </section>
    </main>;
  } finally { await client.end(); }
}
