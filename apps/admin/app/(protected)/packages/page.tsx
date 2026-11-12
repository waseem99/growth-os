import { eq, desc } from "drizzle-orm";
import { brands, getDatabase, offerVersions, offers, productPackages } from "@growth-os/db";
import { requireGrowthUser } from "@/lib/user-access";
import { hasPermission } from "@/lib/authz";
import { createProductPackage, setProductPackageStatus } from "./actions";

export default async function PackagesPage() {
  const user = await requireGrowthUser();
  const canManage = hasPermission(user.role, "campaigns:manage");
  const { db, client } = getDatabase();
  try {
    const [brandRows, packageRows] = await Promise.all([
      db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, "active")).orderBy(brands.name),
      db.select({
        id: productPackages.id, brandId: productPackages.brandId, brandName: brands.name,
        code: productPackages.packageCode, name: offers.name, status: productPackages.status,
        currency: offerVersions.currency, initialAmount: offerVersions.initialAmount,
        recurringAmount: offerVersions.recurringAmount, interval: offerVersions.billingInterval
      }).from(productPackages).innerJoin(brands, eq(brands.id, productPackages.brandId))
        .innerJoin(offerVersions, eq(offerVersions.id, productPackages.offerVersionId))
        .innerJoin(offers, eq(offers.id, offerVersions.offerId)).orderBy(desc(productPackages.createdAt))
    ]);
    return <main className="shell compact-shell">
      <section className="section-heading">
        <p className="eyebrow">Multi-product packages</p>
        <h1>Configure approved campaign prices.</h1>
        <p>Package codes are unique within each product. Packages stay in draft until activated. GrowthOS displays the price; the external product backend must still validate the amount when checkout begins.</p>
      </section>
      {canManage ? <section className="settings-card" style={{ marginTop: 24 }}>
        <h2>Add package</h2>
        <form action={createProductPackage}>
          <div className="asset-upload-grid">
            <label>Product<select name="brandId" required defaultValue=""><option value="" disabled>Select product</option>
              {brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select></label>
            <label>Package code<input name="packageCode" required maxLength={64} placeholder="1" pattern="[A-Za-z0-9_-]+" /></label>
            <label>Display name<input name="name" required maxLength={160} placeholder="Monthly access" /></label>
            <label>Price<input name="price" type="number" min="0.01" step="0.01" required placeholder="566" /></label>
            <label>Currency<select name="currency" defaultValue="PKR"><option value="PKR">PKR</option><option value="USD">USD</option></select></label>
            <label>Billing type<select name="kind" defaultValue="one-time"><option value="one-time">One-time</option><option value="recurring">Recurring</option></select></label>
            <label>Recurring interval (if applicable)<select name="billingInterval" defaultValue="month"><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option></select></label>
          </div>
          <button className="primary-button" type="submit">Save draft package</button>
        </form>
      </section> : null}
      <div className="table-list" style={{ marginTop: 24 }}>
        {packageRows.length === 0 ? <div className="empty-state">No packages configured yet. Add a product package to begin.</div> : null}
        {packageRows.map((item) => <section className="settings-card" key={item.id}>
          <strong>{item.brandName} · {item.name}</strong>
          <p>Code <code>{item.code}</code> · {item.currency} {item.recurringAmount ?? item.initialAmount ?? "—"}{item.recurringAmount ? ` / ${item.interval ?? "period"}` : ""} · {item.status}</p>
          {canManage ? <form action={setProductPackageStatus}>
            <input name="id" type="hidden" value={item.id} />
            <label>Status<select name="status" defaultValue={item.status}>
              <option value="draft">Draft / unavailable</option>
              <option value="active">Active / selectable</option>
              <option value="archived">Archived / unavailable</option>
            </select></label>
            <button type="submit">Update status</button>
          </form> : null}
        </section>)}
      </div>
    </main>;
  } finally { await client.end(); }
}
