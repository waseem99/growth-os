import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  assets, brands, campaigns, domains, getDatabase, landingPages, landingVariations,
  landingVariationVersions, landingVariationPublications, pagePublications, productPackages
} from "@growth-os/db";
import { hasPermission } from "@/lib/authz";
import { requireGrowthUser } from "@/lib/user-access";
import {
  createLandingVariation, saveVariationDraft, publishLandingVariation,
  pauseLandingVariation, rollbackLandingVariation
} from "./actions";
import { VariationLinkBuilder } from "./variation-links";

export default async function VariationsPage() {
  const user = await requireGrowthUser();
  const canManage = hasPermission(user.role, "pages:manage");
  const { db, client } = getDatabase();
  try {
    const [pages, creativeRows, variations, versions, packages, campaignRows] = await Promise.all([
      db.select({
        id: landingPages.id, pageName: landingPages.name, slug: landingPages.slug,
        brandId: landingPages.brandId, brandName: brands.name,
        hostname: domains.hostname, domainStatus: domains.status,
        publishedPageVersionId: pagePublications.versionId
      }).from(landingPages).innerJoin(brands, eq(brands.id, landingPages.brandId))
        .leftJoin(domains, eq(domains.id, landingPages.domainId))
        .leftJoin(pagePublications, eq(pagePublications.pageId, landingPages.id))
        .where(eq(landingPages.status, "draft")).orderBy(brands.name),
      db.select({ id: assets.id, brandId: assets.brandId, title: assets.title, type: assets.type })
        .from(assets).orderBy(desc(assets.createdAt)),
      db.select({
        id: landingVariations.id, brandId: landingVariations.brandId,
        pageId: landingVariations.pageId, key: landingVariations.parameterKey,
        status: landingVariations.status, campaignId: landingVariations.campaignId, pageName: landingPages.name,
        brandName: brands.name, publishedVersionId: landingVariationPublications.versionId
      }).from(landingVariations).innerJoin(landingPages, eq(landingPages.id, landingVariations.pageId))
        .innerJoin(brands, eq(brands.id, landingVariations.brandId))
        .leftJoin(landingVariationPublications, eq(landingVariationPublications.variationId, landingVariations.id))
        .orderBy(desc(landingVariations.createdAt)),
      db.select({
        id: landingVariationVersions.id, variationId: landingVariationVersions.variationId,
        versionNumber: landingVariationVersions.versionNumber,
        bannerAssetId: landingVariationVersions.bannerAssetId,
        overrides: landingVariationVersions.copyOverrides
      }).from(landingVariationVersions).orderBy(desc(landingVariationVersions.versionNumber)),
      db.select({ id: productPackages.id, brandId: productPackages.brandId, code: productPackages.packageCode })
        .from(productPackages).where(eq(productPackages.status, "active")),
      db.select({ id: campaigns.id, brandId: campaigns.brandId, name: campaigns.name })
        .from(campaigns).where(eq(campaigns.status, "active")).orderBy(campaigns.name)
    ]);
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const versionsById = new Map<string, typeof versions>();
    for (const version of versions) versionsById.set(version.variationId, [...(versionsById.get(version.variationId) ?? []), version]);
    const visuals = creativeRows.filter((asset) => ["image", "gif", "svg"].includes(asset.type));
    const nameOf = (id: string | null) => id ? visuals.find((asset) => asset.id === id)?.title ?? id : "Use default banner";

    return <main className="shell compact-shell">
      <section className="section-heading">
        <p className="eyebrow">Dynamic campaign variations</p>
        <h1>Change the banner, not the website.</h1>
        <p>Create banner parameters per product/page; preview the source creative and publish an immutable variation version. The default page, tracking and other products remain independent.</p>
      </section>
      {canManage ? <section className="settings-card" style={{ marginTop: 24 }}>
        <h2>New variation</h2>
        <form action={createLandingVariation}>
          <div className="asset-upload-grid">
            <label>Default landing page<select name="pageId" required defaultValue=""><option value="" disabled>Select page</option>
              {pages.map((page) => <option key={page.id} value={page.id}>{page.brandName} · /{page.slug} — {page.pageName}</option>)}
            </select></label>
            <label>Banner parameter<input name="parameterKey" required maxLength={80} placeholder="ranchers" pattern="[A-Za-z0-9-]+" /></label>
            <label>Campaign (optional)<select name="campaignId" defaultValue=""><option value="">Page default campaign</option>
              {campaignRows.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select></label>
            <label>Banner asset<select name="bannerAssetId" defaultValue=""><option value="">Keep default hero</option>
              {visuals.map((asset) => <option key={asset.id} value={asset.id}>{asset.title ?? asset.id} ({asset.type})</option>)}
            </select></label>
            <label>Headline override (optional)<input name="headline" maxLength={180} /></label>
            <label>Subheadline override (optional)<input name="subheadline" maxLength={500} /></label>
          </div>
          <p>Upload the creative from <Link href="/assets">Ad Creative</Link> first. The selected banner must belong to the same product as the chosen page.</p>
          <button className="primary-button" type="submit">Save draft variation</button>
        </form>
      </section> : null}

      <div className="table-list" style={{ marginTop: 24 }}>
        {variations.length === 0 ? <div className="empty-state">No campaign variations. Add a creative above to begin.</div> : null}
        {variations.map((item) => {
          const parent = pageById.get(item.pageId);
          const history = versionsById.get(item.id) ?? [];
          const latest = history[0];
          const current = history.find((v) => v.id === item.publishedVersionId);
          const approvedPackages = packages.filter((v) => v.brandId === item.brandId);
          const baseUrl = parent?.hostname && parent.domainStatus === "verified"
            ? `https://${parent.hostname}/${parent.slug}` : null;
          const published = item.status === "active" && Boolean(item.publishedVersionId);
          return <section className="settings-card" key={item.id}>
            <div><strong>{item.brandName} · {item.pageName} · <code>{item.key}</code></strong>
              <p>{item.status} · Latest draft v{latest?.versionNumber ?? "—"} · Public v{current?.versionNumber ?? "—"}</p>
              <p>Published banner: {nameOf(current?.bannerAssetId ?? null)}</p>
            </div>
            <p><Link href={`/preview/variations/${item.id}`} target="_blank" rel="noreferrer">Preview latest draft (private)</Link></p>
            {published && baseUrl ? <VariationLinkBuilder baseUrl={baseUrl} parameter={item.key} campaignName={campaignRows.find((c) => c.id === item.campaignId)?.name ?? ""} packages={approvedPackages.map((p) => ({ code: p.code }))} /> : null}
            {!baseUrl && <p>Assign a verified product hostname in <Link href="/brands">Products &amp; Domains</Link> to generate a public campaign link.</p>}
            {canManage && latest ? <>
              <details>
                <summary>Edit creative (creates a new draft version)</summary>
                <form action={saveVariationDraft}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="expectedVersion" value={latest.versionNumber} />
                  <label>Banner<select name="bannerAssetId" defaultValue={latest.bannerAssetId ?? ""}><option value="">Use default hero</option>
                    {visuals.filter((a) => a.brandId === item.brandId).map((asset) => <option key={asset.id} value={asset.id}>{asset.title ?? asset.id}</option>)}
                  </select></label>
                  <label>Headline<input name="headline" maxLength={180} defaultValue={typeof latest.overrides?.headline === "string" ? latest.overrides.headline : ""} /></label>
                  <label>Subheadline<input name="subheadline" maxLength={500} defaultValue={typeof latest.overrides?.subheadline === "string" ? latest.overrides.subheadline : ""} /></label>
                  <button type="submit">Save new draft</button>
                </form>
              </details>
              <form action={publishLandingVariation}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="expectedVersion" value={latest.versionNumber} />
                <button className="primary-button" type="submit" disabled={!parent?.publishedPageVersionId}>Publish latest version</button>
              </form>
              {item.status === "active" ? <form action={pauseLandingVariation}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit">Pause variation</button>
              </form> : null}
              {item.publishedVersionId && history.length > 1 ? <form action={rollbackLandingVariation}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="expectedPublishedVersionId" value={item.publishedVersionId} />
                <label>Restore version<select name="versionId" required defaultValue="">
                  <option value="" disabled>Select historical version</option>
                  {history.filter((version) => version.id !== item.publishedVersionId).map((version) =>
                    <option key={version.id} value={version.id}>Version {version.versionNumber} · {nameOf(version.bannerAssetId)}</option>)}
                </select></label>
                <button type="submit">Rollback to selected version</button>
              </form> : null}
            </> : null}
          </section>;
        })}
      </div>
    </main>;
  } finally { await client.end(); }
}
