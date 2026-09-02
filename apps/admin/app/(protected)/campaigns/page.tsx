import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { assets, brands, campaigns, getDatabase, landingPages, offerVersions, offers } from "@growth-os/db";
import { hasPermission } from "@/lib/authz";
import { parseAssetMetadata } from "@/lib/asset-references";
import { requireGrowthUser } from "@/lib/user-access";
import { createCampaign, updateCampaignStatus, updateCampaignTracking } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const obj = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const field = (value: unknown, key: string) => typeof obj(value)[key] === "string" ? String(obj(value)[key]) : "";

export default async function CampaignsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireGrowthUser();
  const canManage = hasPermission(user.role, "campaigns:manage");
  const query = await searchParams;
  const brandFilter = param(query.brand);
  const platformFilter = param(query.platform).toLowerCase();
  const statusFilter = param(query.status);
  const { db, client } = getDatabase();
  try {
    const [rows, brandRows, offerRows, pageRows, assetRows] = await Promise.all([
      db.select({
        id: campaigns.id,
        brandId: campaigns.brandId,
        brandName: brands.name,
        offerVersionId: campaigns.offerVersionId,
        name: campaigns.name,
        platform: campaigns.platform,
        objective: campaigns.objective,
        status: campaigns.status,
        externalIds: campaigns.externalIds,
        utmDefaults: campaigns.utmDefaults,
        startsAt: campaigns.startsAt,
        endsAt: campaigns.endsAt,
        updatedAt: campaigns.updatedAt
      }).from(campaigns).innerJoin(brands, eq(brands.id, campaigns.brandId)).orderBy(desc(campaigns.updatedAt)),
      db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, "active")),
      db.select({ id: offerVersions.id, brandId: offers.brandId, offerName: offers.name, version: offerVersions.versionNumber, currency: offerVersions.currency, recurringAmount: offerVersions.recurringAmount })
        .from(offerVersions).innerJoin(offers, eq(offers.id, offerVersions.offerId)),
      db.select({ campaignId: landingPages.campaignId, id: landingPages.id }).from(landingPages),
      db.select({ id: assets.id, metadata: assets.metadata, createdAt: assets.createdAt }).from(assets).orderBy(desc(assets.createdAt))
    ]);
    const pageCounts = new Map<string, number>();
    for (const page of pageRows) if (page.campaignId) pageCounts.set(page.campaignId, (pageCounts.get(page.campaignId) ?? 0) + 1);
    const creativeCounts = new Map<string, number>();
    const latestCreative = new Map<string, string>();
    for (const asset of assetRows) {
      const campaignId = parseAssetMetadata(asset.metadata).campaignId;
      if (!campaignId) continue;
      creativeCounts.set(campaignId, (creativeCounts.get(campaignId) ?? 0) + 1);
      if (!latestCreative.has(campaignId)) latestCreative.set(campaignId, asset.id);
    }
    const visible = rows.filter((row) => (!brandFilter || row.brandId === brandFilter) && (!platformFilter || row.platform.toLowerCase() === platformFilter) && (!statusFilter || row.status === statusFilter));
    const platforms = [...new Set(rows.map((row) => row.platform))].sort();

    return <main className="shell compact-shell">
      <section className="section-heading"><p className="eyebrow">Campaigns</p><h1>Ad → matching page → results.</h1><p>Create the campaign once. Then upload the exact Meta/TikTok creative, generate a matching landing-page draft, publish, and review results.</p></section>

      {canManage ? <section className="settings-card" style={{ marginTop: 28 }}>
        <div><h2>New campaign</h2><p>Only the essentials are required. Tracking IDs and UTMs are optional and can be added later.</p></div>
        <form action={createCampaign}>
          <div className="asset-upload-grid">
            <label>Campaign name<input name="name" required maxLength={160} placeholder="September Meta acquisition" /></label>
            <label>Product<select name="brandId" required defaultValue=""><option value="" disabled>Select product</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <label>Platform<select name="platform" defaultValue="meta"><option value="meta">Meta / Facebook</option><option value="tiktok">TikTok</option><option value="instagram">Instagram</option><option value="google">Google</option><option value="organic">Organic</option><option value="other">Other</option></select></label>
            <label>Goal<select name="objective" defaultValue="subscription"><option value="subscription">Subscription</option><option value="signup">Signup</option><option value="lead">Lead</option><option value="purchase">Purchase</option><option value="traffic">Traffic</option></select></label>
          </div>
          <details style={{ margin: "12px 0" }}><summary>Optional offer, dates & tracking</summary><div className="asset-upload-grid" style={{ marginTop: 12 }}>
            <label>Offer version<select name="offerVersionId" defaultValue=""><option value="">No offer snapshot</option>{offerRows.map((offer) => <option key={offer.id} value={offer.id}>{offer.offerName} v{offer.version} · {offer.currency} {offer.recurringAmount ?? "—"}</option>)}</select></label>
            <label>Starts<input name="startsAt" type="datetime-local" /></label><label>Ends<input name="endsAt" type="datetime-local" /></label>
            <label>UTM source<input name="utmSource" placeholder="meta" /></label><label>UTM medium<input name="utmMedium" placeholder="paid_social" /></label><label>UTM campaign<input name="utmCampaign" /></label><label>UTM content<input name="utmContent" /></label>
            <label>External campaign ID<input name="externalCampaignId" /></label><label>External ad set ID<input name="externalAdSetId" /></label><label>External ad ID<input name="externalAdId" /></label><label>External creative ID<input name="externalCreativeId" /></label>
          </div></details>
          <button className="primary-button" type="submit">Create campaign</button>
        </form>
      </section> : null}

      <form className="asset-filters" action="/campaigns">
        <select name="brand" defaultValue={brandFilter}><option value="">All products</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
        <select name="platform" defaultValue={platformFilter}><option value="">All platforms</option>{platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select>
        <select name="status" defaultValue={statusFilter}><option value="">All statuses</option>{["draft", "active", "paused", "completed", "archived"].map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <button type="submit">Filter</button><Link href="/campaigns">Reset</Link>
      </form>

      <div className="table-list">
        {visible.length === 0 ? <div className="empty-state">No campaigns match these filters.</div> : null}
        {visible.map((campaign) => {
          const creativeId = latestCreative.get(campaign.id);
          const matchingPageHref = `/pages?brand=${encodeURIComponent(campaign.brandId)}&campaign=${encodeURIComponent(campaign.id)}${creativeId ? `&creative=${encodeURIComponent(creativeId)}` : ""}`;
          return <section className="settings-card" key={campaign.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
              <div><strong>{campaign.name}</strong><p style={{ margin: "5px 0", color: "#746e82" }}>{campaign.brandName} · {campaign.platform} · {campaign.objective}</p><p style={{ margin: 0, color: "#746e82" }}>{creativeCounts.get(campaign.id) ?? 0} ad creative(s) · {pageCounts.get(campaign.id) ?? 0} landing page(s)</p></div>
              {canManage ? <form action={updateCampaignStatus} style={{ display: "flex", gridTemplateColumns: "none", flexDirection: "row", gap: 8 }}><input type="hidden" name="id" value={campaign.id} /><select name="status" defaultValue={campaign.status}>{["draft", "active", "paused", "completed", "archived"].map((status) => <option key={status} value={status}>{status}</option>)}</select><button type="submit">Save</button></form> : <strong>{campaign.status}</strong>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="primary-button" href={`/assets?brand=${encodeURIComponent(campaign.brandId)}&campaign=${encodeURIComponent(campaign.id)}&platform=${encodeURIComponent(campaign.platform)}`}>1. Upload ad</Link>
              <Link href={matchingPageHref}>{creativeId ? "2. Create matching page" : "2. Create page"}</Link>
              <Link href={`/pages?brand=${encodeURIComponent(campaign.brandId)}&campaign=${encodeURIComponent(campaign.id)}`}>Pages</Link>
              <Link href={`/analytics?brand=${encodeURIComponent(campaign.brandId)}&campaign=${encodeURIComponent(campaign.id)}&platform=${encodeURIComponent(campaign.platform)}`}>3. View results</Link>
            </div>
            {!creativeId ? <p style={{ margin: 0, color: "#746e82" }}>Tip: upload the ad first. Then “Create matching page” will seed the hero visual, headline, supporting copy and CTA from that creative.</p> : null}
            {canManage ? <details><summary>Tracking & external IDs</summary><form action={updateCampaignTracking} style={{ marginTop: 12 }}><input type="hidden" name="id" value={campaign.id} /><input type="hidden" name="brandId" value={campaign.brandId} /><div className="asset-upload-grid">
              <label>UTM source<input name="utmSource" defaultValue={field(campaign.utmDefaults, "source")} /></label><label>UTM medium<input name="utmMedium" defaultValue={field(campaign.utmDefaults, "medium")} /></label><label>UTM campaign<input name="utmCampaign" defaultValue={field(campaign.utmDefaults, "campaign")} /></label><label>UTM term<input name="utmTerm" defaultValue={field(campaign.utmDefaults, "term")} /></label><label>UTM content<input name="utmContent" defaultValue={field(campaign.utmDefaults, "content")} /></label>
              <label>Campaign ID<input name="externalCampaignId" defaultValue={field(campaign.externalIds, "campaignId")} /></label><label>Ad set ID<input name="externalAdSetId" defaultValue={field(campaign.externalIds, "adSetId")} /></label><label>Ad ID<input name="externalAdId" defaultValue={field(campaign.externalIds, "adId")} /></label><label>Creative ID<input name="externalCreativeId" defaultValue={field(campaign.externalIds, "creativeId")} /></label>
            </div><button type="submit">Save tracking</button></form></details> : null}
          </section>;
        })}
      </div>
    </main>;
  } finally {
    await client.end();
  }
}
