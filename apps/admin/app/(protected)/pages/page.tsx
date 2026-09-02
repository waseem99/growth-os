import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { assets, brands, campaigns, getDatabase, landingPages } from "@growth-os/db";
import { hasPermission } from "@/lib/authz";
import { requireGrowthUser } from "@/lib/user-access";
import { PAGE_TEMPLATE_OPTIONS } from "@/lib/page-input";
import { archivePage, createPage } from "./actions";
import styles from "./pages-list.module.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function PagesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireGrowthUser();
  const canManage = hasPermission(user.role, "pages:manage");
  const filters = await searchParams;
  const brandFilter = param(filters.brand);
  const campaignFilter = param(filters.campaign);
  const creativeId = param(filters.creative);
  const templatePrefill = param(filters.template) || "subscription-acquisition";
  const statusFilter = param(filters.status);
  const { db, client } = getDatabase();
  try {
    const [pageRows, brandRows, campaignRows, selectedCreative] = await Promise.all([
      db.select({ id: landingPages.id, name: landingPages.name, slug: landingPages.slug, status: landingPages.status, updatedAt: landingPages.updatedAt, brandId: landingPages.brandId, brandName: brands.name, campaignId: landingPages.campaignId, campaignName: campaigns.name, revision: landingPages.draftRevision })
        .from(landingPages).innerJoin(brands, eq(landingPages.brandId, brands.id)).leftJoin(campaigns, eq(landingPages.campaignId, campaigns.id)).orderBy(desc(landingPages.updatedAt)),
      db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, "active")),
      db.select({ id: campaigns.id, brandId: campaigns.brandId, name: campaigns.name, status: campaigns.status }).from(campaigns).orderBy(desc(campaigns.updatedAt)),
      creativeId ? db.select({ id: assets.id, title: assets.title }).from(assets).where(eq(assets.id, creativeId)).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null)
    ]);
    const visible = pageRows.filter((row) => (!brandFilter || row.brandId === brandFilter) && (!campaignFilter || row.campaignId === campaignFilter) && (!statusFilter || row.status === statusFilter));
    return <main className="shell compact-shell">
      <section className="section-heading"><p className="eyebrow">Landing pages</p><h1>{campaignFilter ? "Create the matching campaign page." : "Build, reuse and iterate campaign pages."}</h1><p>{campaignFilter ? "Product and campaign are preselected. If you came from an uploaded ad, its visual and saved ad copy will seed the first draft automatically." : "Create a page directly, or start from Campaigns so the product, campaign and ad message are carried into the draft."}</p></section>
      {canManage && <form className={styles.create} action={createPage}>
        <input name="name" required placeholder="Landing page name" maxLength={160} /><input name="slug" placeholder="URL slug (optional)" maxLength={120} />
        <select name="brandId" required defaultValue={brandFilter}><option value="" disabled>Product</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
        <select name="campaignId" defaultValue={campaignFilter}><option value="">No campaign</option>{campaignRows.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
        <select name="templateKey" defaultValue={templatePrefill}>{PAGE_TEMPLATE_OPTIONS.map((template) => <option key={template.key} value={template.key}>{template.label}</option>)}</select>
        {selectedCreative ? <><input type="hidden" name="creativeAssetId" value={selectedCreative.id} /><div className={styles.creativeHint}>Ad creative: <strong>{selectedCreative.title || selectedCreative.id}</strong> · visual/copy will seed the page</div></> : null}
        <button className="primary-button" type="submit">Create matching page</button>
      </form>}
      <form className={styles.filters} action="/pages">
        <select name="brand" defaultValue={brandFilter}><option value="">All products</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
        <select name="campaign" defaultValue={campaignFilter}><option value="">All campaigns</option>{campaignRows.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
        <select name="status" defaultValue={statusFilter}><option value="">All statuses</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
        <button type="submit">Filter</button><Link href="/pages">Reset</Link>
      </form>
      <div className={styles.table} role="table" aria-label="Landing pages">
        {visible.length === 0 && <div className={styles.empty}>No pages match these filters.</div>}
        {visible.map((page) => <article className={styles.row} key={page.id}>
          <div><Link className={styles.name} href={`/pages/${page.id}`}>{page.name}</Link><code>/{page.slug}</code></div>
          <span>{page.brandName}</span><span>{page.campaignName ?? "No campaign"}</span>
          <span className={`${styles.status} ${page.status === "draft" ? styles.draft : styles.archived}`}>{page.status}</span>
          <span>r{page.revision} · {page.updatedAt.toLocaleString("en-PK")}</span>
          {canManage && page.status !== "archived" ? <form action={archivePage}><input type="hidden" name="id" value={page.id} /><button type="submit">Archive</button></form> : <span />}
        </article>)}
      </div>
    </main>;
  } finally { await client.end(); }
}
