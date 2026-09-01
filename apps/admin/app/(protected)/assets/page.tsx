import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { assetUsages, assets as assetTable, brands, campaigns, getDatabase } from "@growth-os/db";
import { hasPermission } from "@/lib/authz";
import { parseAssetMetadata } from "@/lib/asset-references";
import { requireGrowthUser } from "@/lib/user-access";
import { AssetUpload } from "./asset-upload";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function AssetsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireGrowthUser();
  const canManage = hasPermission(user.role, "assets:manage");
  const query = await searchParams;
  const q = param(query.q).toLowerCase();
  const brandFilter = param(query.brand);
  const typeFilter = param(query.type);
  const tagFilter = param(query.tag).toLowerCase();
  const usageFilter = param(query.usage);
  const { db, client } = getDatabase();
  try {
    const [rows, brandRows, campaignRows, usages] = await Promise.all([
      db.select({
        id: assetTable.id,
        brandId: assetTable.brandId,
        brandName: brands.name,
        type: assetTable.type,
        storageKey: assetTable.storageKey,
        mimeType: assetTable.mimeType,
        title: assetTable.title,
        altText: assetTable.altText,
        width: assetTable.width,
        height: assetTable.height,
        fileSize: assetTable.fileSize,
        metadata: assetTable.metadata,
        createdAt: assetTable.createdAt
      }).from(assetTable).innerJoin(brands, eq(assetTable.brandId, brands.id)).orderBy(desc(assetTable.createdAt)),
      db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, "active")),
      db.select({ id: campaigns.id, brandId: campaigns.brandId, name: campaigns.name }).from(campaigns).orderBy(desc(campaigns.updatedAt)),
      db.select({ assetId: assetUsages.assetId }).from(assetUsages)
    ]);
    const usageCount = new Map<string, number>();
    for (const usage of usages) usageCount.set(usage.assetId, (usageCount.get(usage.assetId) ?? 0) + 1);
    const visible = rows.filter((asset) => {
      const meta = parseAssetMetadata(asset.metadata);
      const haystack = `${asset.title ?? ""} ${asset.altText ?? ""} ${meta.originalName ?? ""} ${(meta.tags ?? []).join(" ")} ${meta.platform ?? ""} ${meta.creativeId ?? ""}`.toLowerCase();
      const count = usageCount.get(asset.id) ?? 0;
      return (!q || haystack.includes(q)) && (!brandFilter || asset.brandId === brandFilter) && (!typeFilter || asset.type === typeFilter) && (!tagFilter || (meta.tags ?? []).includes(tagFilter)) && (!usageFilter || (usageFilter === "used" ? count > 0 : count === 0));
    });

    return <main className="shell compact-shell">
      <section className="section-heading"><p className="eyebrow">Asset Library</p><h1>One source for campaign creative.</h1><p>Stable asset IDs, searchable metadata and explicit usage tracking keep page content independent from raw storage URLs.</p></section>
      {canManage && <AssetUpload brands={brandRows} campaigns={campaignRows} />}
      <form className="asset-filters" action="/assets">
        <input name="q" defaultValue={param(query.q)} placeholder="Search title, tag, creative ID…" />
        <select name="brand" defaultValue={brandFilter}><option value="">All brands</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
        <select name="type" defaultValue={typeFilter}><option value="">All types</option><option value="image">Image</option><option value="video">Video</option><option value="gif">GIF</option><option value="svg">SVG</option></select>
        <input name="tag" defaultValue={tagFilter} placeholder="Tag" />
        <select name="usage" defaultValue={usageFilter}><option value="">Any usage</option><option value="used">Used</option><option value="unused">Unused</option></select>
        <button type="submit">Filter</button><Link href="/assets">Reset</Link>
      </form>
      <div className="asset-grid">
        {visible.map((asset) => {
          const meta = parseAssetMetadata(asset.metadata);
          const count = usageCount.get(asset.id) ?? 0;
          return <Link className="asset-card" href={`/assets/${asset.id}`} key={asset.id}>
            <div className="asset-preview">{asset.type === "video" ? <span>VIDEO</span> : <img src={asset.storageKey} alt={asset.altText ?? ""} loading="lazy" />}</div>
            <div className="asset-card-body"><div><strong>{asset.title || meta.originalName || "Untitled asset"}</strong><span>{asset.brandName} · {asset.type}</span></div><code>{asset.id}</code><p>{asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}{asset.fileSize ? `${Math.round(asset.fileSize / 1024)} KB · ` : ""}{count} usage{count === 1 ? "" : "s"}</p>{meta.tags?.length ? <div className="tag-row">{meta.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div> : null}</div>
          </Link>;
        })}
        {visible.length === 0 && <div className="empty-state">No assets match these filters.</div>}
      </div>
    </main>;
  } finally { await client.end(); }
}
