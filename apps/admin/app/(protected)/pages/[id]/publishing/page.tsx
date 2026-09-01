import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { domains, getDatabase, landingPages, pagePublications, pageVersions, users } from "@growth-os/db";
import { defaultPageSeo, pageSeoSchema } from "@growth-os/page-engine";
import { requireGrowthUser } from "@/lib/user-access";
import { PublishPanel } from "./publish-panel";

export default async function PublishingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGrowthUser();
  const { id } = await params;
  const { db, client } = getDatabase();
  try {
    const [page] = await db.select({ id: landingPages.id, name: landingPages.name, revision: landingPages.draftRevision, seo: landingPages.draftSeo, domainId: landingPages.domainId, domainHostname: domains.hostname, domainStatus: domains.status })
      .from(landingPages).leftJoin(domains, eq(landingPages.domainId, domains.id)).where(eq(landingPages.id, id)).limit(1);
    if (!page) notFound();
    const [publication, versions] = await Promise.all([
      db.select({ versionId: pagePublications.versionId }).from(pagePublications).where(eq(pagePublications.pageId, id)).limit(1).then((rows) => rows[0]),
      db.select({ id: pageVersions.id, number: pageVersions.versionNumber, createdAt: pageVersions.createdAt, publishNote: pageVersions.publishNote, author: users.email })
        .from(pageVersions).leftJoin(users, eq(pageVersions.createdBy, users.id)).where(eq(pageVersions.pageId, id)).orderBy(desc(pageVersions.versionNumber))
    ]);
    const parsedSeo = pageSeoSchema.safeParse(page.seo);
    const initialSeo = parsedSeo.success ? parsedSeo.data : defaultPageSeo(page.name);
    const domainLabel = page.domainId ? `${page.domainHostname ?? "assigned domain"} (${page.domainStatus ?? "unknown"})` : "platform fallback URL";
    return <main className="shell compact-shell">
      <div className="publishing-heading"><div><Link href={`/pages/${id}`}>← Back to editor</Link><p className="eyebrow">Page lifecycle</p><h1>{page.name}</h1><p>Draft changes and published versions are separate. Visitors only ever receive the active immutable version.</p></div></div>
      <PublishPanel pageId={id} initialRevision={page.revision} initialSeo={initialSeo} versions={versions.map((version) => ({ ...version, createdAt: version.createdAt.toISOString() }))} currentVersionId={publication?.versionId ?? null} domainLabel={domainLabel} />
    </main>;
  } finally { await client.end(); }
}
