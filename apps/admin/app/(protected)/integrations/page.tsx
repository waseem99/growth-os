import { eq } from "drizzle-orm";
import { brands, getDatabase, integrations } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";
import { savePublicIntegration } from "./actions";

const PROVIDERS = [
  { key: "meta", label: "Meta Pixel", field: "pixelId", fieldLabel: "Pixel ID", hint: "Public browser Pixel identifier only" },
  { key: "tiktok", label: "TikTok Pixel", field: "pixelId", fieldLabel: "Pixel ID", hint: "Public browser Pixel identifier only" },
  { key: "ga4", label: "Google Analytics 4", field: "measurementId", fieldLabel: "Measurement ID", hint: "For example G-XXXXXXXXXX" },
  { key: "gtm", label: "Google Tag Manager", field: "containerId", fieldLabel: "Container ID", hint: "For example GTM-XXXXXXX" }
] as const;

const configValue = (config: unknown, key: string) => {
  if (!config || typeof config !== "object") return "";
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
};

export default async function IntegrationsPage() {
  await requirePermission("integrations:manage");
  const { db, client } = getDatabase();
  try {
    const [brandRows, rows] = await Promise.all([
      db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, "active")),
      db.select({ id: integrations.id, brandId: integrations.brandId, provider: integrations.provider, status: integrations.status, publicConfig: integrations.publicConfig, secretRef: integrations.secretRef }).from(integrations)
    ]);
    const current = new Map(rows.map((row) => [`${row.brandId}:${row.provider}`, row]));
    return <main className="shell compact-shell">
      <section className="section-heading"><p className="eyebrow">Integrations</p><h1>Configure brand-level measurement IDs safely.</h1><p>Only public browser identifiers belong here. Server tokens, API keys and conversion secrets remain environment-managed and are never stored or exposed through this screen.</p></section>
      <div className="table-list" style={{ marginTop: 30 }}>
        {brandRows.map((brand) => <section className="settings-card" key={brand.id}>
          <div><h2>{brand.name}</h2><p>Measurement providers can be enabled independently for this brand.</p></div>
          <div className="asset-detail-grid">
            {PROVIDERS.map((provider) => {
              const integration = current.get(`${brand.id}:${provider.key}`);
              return <form action={savePublicIntegration} className="settings-card" key={provider.key}>
                <input type="hidden" name="brandId" value={brand.id} /><input type="hidden" name="provider" value={provider.key} />
                <div><strong>{provider.label}</strong><p style={{ margin: "4px 0", color: "#746e82" }}>{provider.hint}</p></div>
                <label>{provider.fieldLabel}<input name={provider.field} defaultValue={configValue(integration?.publicConfig, provider.field)} placeholder={provider.fieldLabel} /></label>
                <label className="check-label"><input type="checkbox" name="enabled" defaultChecked={integration?.status === "enabled"} /> Enabled</label>
                {integration?.secretRef ? <p>Server secret reference: configured externally.</p> : null}
                <button type="submit">Save {provider.label}</button>
              </form>;
            })}
          </div>
        </section>)}
      </div>
    </main>;
  } finally {
    await client.end();
  }
}
