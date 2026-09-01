import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { brands, campaigns, getDatabase, landingPages } from "@growth-os/db";
import { hasPermission } from "@/lib/authz";
import { requireGrowthUser } from "@/lib/user-access";
import { PAGE_TEMPLATE_OPTIONS } from "@/lib/page-input";
import { archivePage, createPage } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function PagesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireGrowthUser();
  const canManage = hasPermission(user.role, "pages:manage");
  const filters = await searchParams;
  const brandFilter = param(filters.brand);
  const campaignFilter = param(filters.campaign);
  const statusFilter = param(filters.status);
  const { db, client } = getDatabase();
  try {
    const [pageRows, brandRows, campaignRows] = await Promise.all([
      db.select({
        id: landingPages.id,
        name: landingPages.name,
        slug: landingPages.slug,
        status: landingPages.status,
        updatedAt: landingPages.updatedAt,
        brandId: landingPages.brandId,
        brandName: brands.name,
        campaignId: landingPages.campaignId,
        campaignName: campaigns.name,
        revision: landingPages.draftRevision
      }).from(landingPages).innerJoin(brands, eq(landingPages.brandId, brands.id)).leftJoin(campaigns, eq(landingPages.campaignId, campaigns.id)).orderBy(desc(landingPages.updatedAt)),
      db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, "active")),
      db.select({ id: campaigns.id, brandId: campaigns.brandId, name: campaigns.name, status: campaigns.status }).from(campaigns).orderBy(desc(campaigns.updatedAt))
    ]);
    const visible = pageRows.filter((row) =>
      (!brandFilter || row.brandId === brandFilter) &&
      (!campaignFilter || row.campaignId === campaignFilter) &&
      (!statusFilter || row.status === statusFilter)
    );

    return (
      <main className="shell compact-shell">
        <section className="section-heading">
          <p className="eyebrow">Landing pages</p>
          <h1>Build, reuse and iterate campaign pages.</h1>
          <p>Structured drafts only. Preview and publishing use the same page engine as the public renderer.</p>
        </section>

        {canManage && (
          <form className="page-create" action={createPage}>
            <input name="name" required placeholder="Page name" maxLength={160} />
            <input name="slug" placeholder="URL slug (optional)" maxLength={120} />
            <select name="brandId" required defaultValue="">
              <option value="" disabled>Brand</option>
              {brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
            <select name="campaignId" defaultValue=""><option value="">No campaign</option>{campaignRows.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
            <select name="templateKey" defaultValue="subscription-acquisition">{PAGE_TEMPLATE_OPTIONS.map((template) => <option key={template.key} value={template.key}>{template.label}</option>)}</select>
            <button className="primary-button" type="submit">Create page</button>
          </form>
        )}

        <form className="page-filters" action="/pages">
          <select name="brand" defaultValue={brandFilter}><option value="">All brands</option>{brandRows.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
          <select name="campaign" defaultValue={campaignFilter}><option value="">All campaigns</option>{campaignRows.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
          <select name="status" defaultValue={statusFilter}><option value="">All statuses</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
          <button type="submit">Filter</button>
          <Link href="/pages">Reset</Link>
        </form>

        <div className="page-table" role="table" aria-label="Landing pages">
          {visible.length === 0 && <div className="empty-state">No pages match these filters.</div>}
          {visible.map((page) => (
            <article className="page-row" key={page.id}>
              <div>
                <Link className="page-name" href={`/pages/${page.id}`}>{page.name}</Link>
                <code>/{page.slug}</code>
              </div>
              <span>{page.brandName}</span>
              <span>{page.campaignName ?? "No campaign"}</span>
              <span className={`status-pill status-${page.status}`}>{page.status}</span>
              <span>r{page.revision} · {page.updatedAt.toLocaleString("en-PK")}</span>
              {canManage && page.status !== "archived" ? <form action={archivePage}><input type="hidden" name="id" value={page.id} /><button type="submit">Archive</button></form> : <span />}
            </article>
          ))}
        </div>
      </main>
    );
  } finally {
    await client.end();
  }
}
