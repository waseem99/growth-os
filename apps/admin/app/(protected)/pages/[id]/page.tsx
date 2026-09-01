import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { brands, campaigns, getDatabase, landingPages } from "@growth-os/db";
import { pageDocumentSchema, type BrandRenderTheme } from "@growth-os/page-engine";
import { hasPermission } from "@/lib/authz";
import { requireGrowthUser } from "@/lib/user-access";
import { instantiatePageTemplate } from "@/lib/page-input";
import { PageEditor } from "../page-editor";

export default async function PageEditorRoute({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireGrowthUser();
  const { id } = await params;
  const { db, client } = getDatabase();
  try {
    const [page] = await db.select({
      id: landingPages.id,
      name: landingPages.name,
      slug: landingPages.slug,
      status: landingPages.status,
      brandId: landingPages.brandId,
      campaignId: landingPages.campaignId,
      conversionGoal: landingPages.conversionGoal,
      draftContent: landingPages.draftContent,
      draftRevision: landingPages.draftRevision,
      brandTheme: brands.theme,
      brandName: brands.name
    }).from(landingPages).innerJoin(brands, eq(landingPages.brandId, brands.id)).where(eq(landingPages.id, id)).limit(1);
    if (!page) notFound();
    const [brandRows, campaignRows] = await Promise.all([
      db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.status, "active")),
      db.select({ id: campaigns.id, brandId: campaigns.brandId, name: campaigns.name, status: campaigns.status }).from(campaigns)
    ]);
    const parsed = pageDocumentSchema.safeParse(page.draftContent);
    const document = parsed.success ? parsed.data : instantiatePageTemplate("minimal");
    return <>
      <div className="page-lifecycle-strip"><span>Draft revision {page.draftRevision}</span><div><Link href={`/preview/pages/${id}`} target="_blank">Preview draft ↗</Link>{hasPermission(user.role, "ai:use") ? <Link href={`/pages/${id}/ai`}>AI assistant →</Link> : null}<Link href={`/pages/${id}/publishing`}>Publishing & versions →</Link></div></div>
      <PageEditor
        initial={{
          id: page.id,
          name: page.name,
          slug: page.slug,
          brandId: page.brandId,
          campaignId: page.campaignId,
          conversionGoal: page.conversionGoal ?? "subscription",
          revision: page.draftRevision,
          status: page.status,
          document
        }}
        brands={brandRows}
        campaigns={campaignRows}
        theme={page.brandTheme as BrandRenderTheme}
        recoveredInvalidDraft={!parsed.success}
      />
    </>;
  } finally {
    await client.end();
  }
}
