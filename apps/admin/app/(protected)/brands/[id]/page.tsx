import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { brands, domains, getDatabase } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { addDomain, updateBrand, updateDomain } from "../actions";

const field = (obj: unknown, key: string, fallback = "") => typeof obj === "object" && obj !== null && typeof (obj as Record<string, unknown>)[key] === "string" ? String((obj as Record<string, unknown>)[key]) : fallback;

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("brands:manage");
  const { id } = await params;
  const { db, client } = getDatabase();
  const result = await (async () => {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
    if (!brand) return null;
    const domainRows = await db.select().from(domains).where(eq(domains.brandId, id)).orderBy(asc(domains.hostname));
    return { brand, domainRows };
  })().finally(async () => client.end());
  if (!result) notFound();
  const { brand, domainRows } = result;
  const primary = field(brand.theme, "primary", "#6236ff");
  const secondary = field(brand.theme, "secondary", "#17131f");
  const background = field(brand.theme, "background", "#ffffff");
  const text = field(brand.theme, "text", "#15111f");

  return (
    <main className="shell compact-shell">
      <section className="section-heading"><p className="eyebrow">Brand configuration</p><h1>{brand.name}</h1><p>Only approved tokens/defaults are editable here. Integration secrets are intentionally not part of this configuration.</p></section>
      <div className="brand-config-grid">
        <form className="settings-card" action={updateBrand}>
          <input type="hidden" name="id" value={brand.id} />
          <label>Name<input name="name" defaultValue={brand.name} required /></label>
          <label>Slug<input name="slug" defaultValue={brand.slug} required /></label>
          <label>Status<select name="status" defaultValue={brand.status}><option value="active">Active</option><option value="archived">Archived</option></select></label>
          <div className="token-row"><label>Primary<input name="primary" type="color" defaultValue={primary} /></label><label>Secondary<input name="secondary" type="color" defaultValue={secondary} /></label><label>Background<input name="background" type="color" defaultValue={background} /></label><label>Text<input name="text" type="color" defaultValue={text} /></label></div>
          <label>Font family<input name="fontFamily" defaultValue={field(brand.theme, "fontFamily", "Inter, system-ui, sans-serif")} /></label>
          <label>Radius<input name="radius" defaultValue={field(brand.theme, "radius", "16px")} /></label>
          <label>Locale<input name="locale" defaultValue={field(brand.defaults, "locale", "en-PK")} /></label>
          <label>Default CTA<input name="defaultCtaLabel" defaultValue={field(brand.defaults, "defaultCtaLabel", "Get started")} /></label>
          <label>Default conversion goal<input name="defaultConversionGoal" defaultValue={field(brand.defaults, "defaultConversionGoal", "subscription_started")} /></label>
          <label>Default SEO title<input name="defaultSeoTitle" defaultValue={field(brand.defaults, "defaultSeoTitle")} /></label>
          <label>Terms URL<input name="termsUrl" type="url" defaultValue={field(brand.defaults, "termsUrl")} /></label>
          <label>Privacy URL<input name="privacyUrl" type="url" defaultValue={field(brand.defaults, "privacyUrl")} /></label>
          <label>Subscription destination<input name="subscriptionUrl" type="url" defaultValue={field(brand.defaults, "subscriptionUrl")} /></label>
          <button className="primary-button" type="submit">Save brand</button>
        </form>
        <aside className="theme-preview" style={{ background, color: text, borderRadius: field(brand.theme, "radius", "16px"), fontFamily: field(brand.theme, "fontFamily", "Inter, system-ui, sans-serif") }}><span style={{ color: primary }}>Live token preview</span><h2>{brand.name}</h2><p>Campaign pages inherit these defaults unless a safe template preset overrides them.</p><button type="button" style={{ background: primary, color: "#fff", borderRadius: field(brand.theme, "radius", "16px") }}>CTA example</button><div style={{ background: secondary }} /></aside>
      </div>
      <section className="domain-section"><div className="section-heading"><p className="eyebrow">Domains</p><h2>Host mapping</h2></div>
        <form className="inline-form" action={addDomain}><input type="hidden" name="brandId" value={brand.id} /><input name="hostname" placeholder="go.example.com" required /><label className="check-label"><input name="isPrimary" type="checkbox" /> Primary</label><button className="primary-button" type="submit">Add domain</button></form>
        <div className="table-list">{domainRows.map((domain) => <form className="domain-row" action={updateDomain} key={domain.id}><input type="hidden" name="id" value={domain.id} /><input type="hidden" name="brandId" value={brand.id} /><strong>{domain.hostname}</strong><select name="status" defaultValue={domain.status}><option value="pending">Pending DNS</option><option value="verified">Verified</option><option value="disabled">Disabled</option></select><label className="check-label"><input name="isPrimary" type="checkbox" defaultChecked={domain.isPrimary} /> Primary</label><button type="submit">Save</button></form>)}</div>
      </section>
    </main>
  );
}
