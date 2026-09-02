import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { assetUsages, assets as assetTable, brands, campaigns, getDatabase, landingPages } from "@growth-os/db";
import { hasPermission } from "@/lib/authz";
import { parseAssetMetadata } from "@/lib/asset-references";
import { requireGrowthUser } from "@/lib/user-access";
import { deleteAsset, replaceAssetInDrafts, updateAssetMetadata } from "../actions";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireGrowthUser();
  const canManage = hasPermission(user.role, "assets:manage");
  const canUseAi = hasPermission(user.role, "ai:use");
  const { id } = await params;
  const { db, client } = getDatabase();
  try {
    const [asset] = await db.select({
      id: assetTable.id, brandId: assetTable.brandId, brandName: brands.name, type: assetTable.type, storageKey: assetTable.storageKey,
      mimeType: assetTable.mimeType, title: assetTable.title, altText: assetTable.altText, width: assetTable.width, height: assetTable.height,
      fileSize: assetTable.fileSize, metadata: assetTable.metadata, createdAt: assetTable.createdAt
    }).from(assetTable).innerJoin(brands, eq(assetTable.brandId, brands.id)).where(eq(assetTable.id, id)).limit(1);
    if (!asset) notFound();
    const meta = parseAssetMetadata(asset.metadata);
    const [usages, alternatives, campaignRows] = await Promise.all([
      db.select({ id: assetUsages.id, entityType: assetUsages.entityType, entityId: assetUsages.entityId, fieldPath: assetUsages.fieldPath, pageName: landingPages.name })
        .from(assetUsages).leftJoin(landingPages, eq(assetUsages.entityId, landingPages.id)).where(eq(assetUsages.assetId, id)).orderBy(desc(assetUsages.createdAt)),
      db.select({ id: assetTable.id, title: assetTable.title, type: assetTable.type }).from(assetTable).where(and(eq(assetTable.brandId, asset.brandId), ne(assetTable.id, id))).orderBy(desc(assetTable.createdAt)),
      db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(eq(campaigns.brandId, asset.brandId)).orderBy(desc(campaigns.updatedAt))
    ]);
    const draftPageIds = [...new Set(usages.filter((usage) => usage.entityType === "landing_page_draft").map((usage) => usage.entityId))];

    return <main className="shell compact-shell">
      <div className="asset-detail-heading"><div><Link href="/assets">← Ad creative</Link><p className="eyebrow">{asset.brandName} · {asset.type}</p><h1>{meta.adHeadline || asset.title || meta.originalName || "Untitled creative"}</h1><code>{asset.id}</code>{canUseAi ? <Link className="ai-inline-link" href={`/assets/${id}/ai`}>AI metadata assistant →</Link> : null}</div><div className="asset-detail-preview">{asset.type === "video" ? <video src={asset.storageKey} controls preload="metadata" /> : <a href={asset.storageKey} target="_blank" rel="noreferrer">Open stored creative</a>}</div></div>

      <div className="asset-detail-grid">
        <section className="settings-card">
          <h2>Ad message</h2><p>Keep these fields aligned with the live Meta/TikTok ad. A matching page can seed its hero from them.</p>
          {canManage ? <form action={async (formData) => {
            "use server";
            await updateAssetMetadata({ id, title: String(formData.get("title") ?? ""), altText: String(formData.get("altText") ?? ""), tags: String(formData.get("tags") ?? ""), campaignId: String(formData.get("campaignId") ?? "") || null, platform: String(formData.get("platform") ?? ""), creativeId: String(formData.get("creativeId") ?? ""), adHeadline: String(formData.get("adHeadline") ?? ""), adPrimaryText: String(formData.get("adPrimaryText") ?? ""), adCta: String(formData.get("adCta") ?? "") });
          }}>
            <label>Ad headline<input name="adHeadline" defaultValue={meta.adHeadline ?? ""} /></label>
            <label>Primary ad text<textarea name="adPrimaryText" defaultValue={meta.adPrimaryText ?? ""} /></label>
            <label>CTA label<input name="adCta" defaultValue={meta.adCta ?? ""} /></label>
            <label>Internal title<input name="title" defaultValue={asset.title ?? ""} /></label>
            <label>Alt text<input name="altText" defaultValue={asset.altText ?? ""} /></label>
            <label>Tags<input name="tags" defaultValue={(meta.tags ?? []).join(", ")} /></label>
            <label>Campaign<select name="campaignId" defaultValue={meta.campaignId ?? ""}><option value="">No campaign</option>{campaignRows.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
            <label>Platform<input name="platform" defaultValue={meta.platform ?? ""} /></label>
            <label>Ad / creative ID<input name="creativeId" defaultValue={meta.creativeId ?? ""} /></label>
            <button className="primary-button" type="submit">Save ad message</button>
          </form> : <p>Read-only access.</p>}
        </section>

        <section className="settings-card">
          <h2>Where used</h2>
          {usages.length === 0 ? <p>No tracked page usages yet.</p> : <div className="usage-list">{usages.map((usage) => <div key={usage.id}><div><strong>{usage.pageName || usage.entityType}</strong><code>{usage.fieldPath}</code></div>{usage.entityType === "landing_page_draft" ? <Link href={`/pages/${usage.entityId}`}>Open draft</Link> : <span>{usage.entityType}</span>}</div>)}</div>}
        </section>
      </div>

      {canManage && draftPageIds.length > 0 && alternatives.length > 0 ? <section className="settings-card asset-replace-card">
        <h2>Replace selected draft usages</h2><p>Published versions are never silently mutated. This operation updates only the draft pages you explicitly select.</p>
        <form action={async (formData) => {
          "use server";
          await replaceAssetInDrafts({ oldAssetId: id, newAssetId: String(formData.get("newAssetId") ?? ""), pageIds: formData.getAll("pageId").map(String) });
        }}>
          <label>Replacement asset<select name="newAssetId" required defaultValue=""><option value="" disabled>Select asset</option>{alternatives.map((alternative) => <option key={alternative.id} value={alternative.id}>{alternative.title || alternative.id} · {alternative.type}</option>)}</select></label>
          <div className="replace-pages">{draftPageIds.map((pageId) => { const usage = usages.find((entry) => entry.entityId === pageId); return <label key={pageId}><input type="checkbox" name="pageId" value={pageId} defaultChecked /> {usage?.pageName || pageId}</label>; })}</div>
          <button type="submit">Replace selected drafts</button>
        </form>
      </section> : null}

      {canManage ? <section className="danger-zone"><div><strong>Delete asset</strong><p>Deletion is blocked while any tracked draft/published usage or brand default references this asset.</p></div><form action={deleteAsset}><input type="hidden" name="id" value={id} /><button type="submit" disabled={usages.length > 0}>Delete permanently</button></form></section> : null}
    </main>;
  } finally { await client.end(); }
}
