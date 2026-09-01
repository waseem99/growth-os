import { and, eq } from "drizzle-orm";
import { brands, domains, getDatabase, landingPages, pagePublications, pageVersions } from "@growth-os/db";

export function normalizeRequestHost(value: string | null) {
  if (!value) return "";
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("[")) return first;
  return first.split(":")[0] ?? "";
}

export async function resolveBrandByHost(host: string) {
  const normalized = normalizeRequestHost(host);
  if (!normalized) return null;
  const { db, client } = getDatabase();
  try {
    const [row] = await db.select({ id: brands.id, name: brands.name, slug: brands.slug, theme: brands.theme, defaults: brands.defaults, hostname: domains.hostname, domainId: domains.id }).from(domains).innerJoin(brands, eq(brands.id, domains.brandId)).where(and(eq(domains.hostname, normalized), eq(domains.status, "verified"), eq(brands.status, "active"))).limit(1);
    return row ?? null;
  } finally { await client.end(); }
}

export async function resolvePublishedPage(host: string, slug: string) {
  const normalized = normalizeRequestHost(host);
  if (!normalized || !slug) return null;
  const { db, client } = getDatabase();
  try {
    const [row] = await db.select({
      brandId: brands.id,
      brandName: brands.name,
      brandSlug: brands.slug,
      theme: brands.theme,
      defaults: brands.defaults,
      pageId: landingPages.id,
      pageName: landingPages.name,
      slug: landingPages.slug,
      content: pageVersions.content,
      seo: pageVersions.seo,
      versionId: pageVersions.id,
      versionNumber: pageVersions.versionNumber
    }).from(domains)
      .innerJoin(brands, eq(brands.id, domains.brandId))
      .innerJoin(landingPages, and(eq(landingPages.brandId, brands.id), eq(landingPages.domainId, domains.id)))
      .innerJoin(pagePublications, eq(pagePublications.pageId, landingPages.id))
      .innerJoin(pageVersions, eq(pageVersions.id, pagePublications.versionId))
      .where(and(eq(domains.hostname, normalized), eq(domains.status, "verified"), eq(brands.status, "active"), eq(landingPages.status, "draft"), eq(landingPages.slug, slug)))
      .limit(1);
    return row ?? null;
  } finally { await client.end(); }
}
