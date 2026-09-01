import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { brands, domains, getDatabase, landingPages, offerVersions, pagePublications, pageVersions } from "@growth-os/db";

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
    const [row] = await db.select({ id: brands.id, name: brands.name, slug: brands.slug, theme: brands.theme, defaults: brands.defaults, hostname: domains.hostname, domainId: domains.id })
      .from(domains).innerJoin(brands, eq(brands.id, domains.brandId))
      .where(and(eq(domains.hostname, normalized), eq(domains.status, "verified"), eq(brands.status, "active"))).limit(1);
    return row ?? null;
  } finally { await client.end(); }
}

async function resolvePublishedPageUncached(host: string, slug: string) {
  const normalized = normalizeRequestHost(host);
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, "");
  if (!normalized || !normalizedSlug) return null;
  const { db, client } = getDatabase();
  try {
    const [row] = await db.select({
      hostname: domains.hostname,
      brandId: brands.id,
      brandName: brands.name,
      brandSlug: brands.slug,
      theme: brands.theme,
      defaults: brands.defaults,
      defaultSocialAssetId: brands.defaultSocialAssetId,
      pageId: landingPages.id,
      campaignId: landingPages.campaignId,
      pageName: landingPages.name,
      slug: landingPages.slug,
      content: pageVersions.content,
      seo: pageVersions.seo,
      versionId: pageVersions.id,
      versionNumber: pageVersions.versionNumber,
      currency: offerVersions.currency,
      initialAmount: offerVersions.initialAmount,
      recurringAmount: offerVersions.recurringAmount,
      billingInterval: offerVersions.billingInterval,
      trialDays: offerVersions.trialDays,
      autoRenew: offerVersions.autoRenew
    }).from(domains)
      .innerJoin(brands, eq(brands.id, domains.brandId))
      .innerJoin(landingPages, and(eq(landingPages.brandId, brands.id), eq(landingPages.domainId, domains.id)))
      .innerJoin(pagePublications, eq(pagePublications.pageId, landingPages.id))
      .innerJoin(pageVersions, eq(pageVersions.id, pagePublications.versionId))
      .leftJoin(offerVersions, eq(offerVersions.id, pageVersions.offerVersionId))
      .where(and(eq(domains.hostname, normalized), eq(domains.status, "verified"), eq(brands.status, "active"), eq(landingPages.status, "draft"), eq(landingPages.slug, normalizedSlug)))
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      offer: row.currency ? {
        currency: row.currency,
        initialAmount: row.initialAmount,
        recurringAmount: row.recurringAmount,
        billingInterval: row.billingInterval,
        trialDays: row.trialDays,
        autoRenew: row.autoRenew ?? false
      } : undefined
    };
  } finally { await client.end(); }
}

export const resolvePublishedPage = unstable_cache(resolvePublishedPageUncached, ["growthos-published-page-v1"], { revalidate: 60 });

export async function listPublishedPagesForHost(host: string) {
  const normalized = normalizeRequestHost(host);
  if (!normalized) return [];
  const { db, client } = getDatabase();
  try {
    return await db.select({ slug: landingPages.slug, seo: pageVersions.seo, updatedAt: pagePublications.publishedAt })
      .from(domains).innerJoin(brands, eq(brands.id, domains.brandId))
      .innerJoin(landingPages, and(eq(landingPages.brandId, brands.id), eq(landingPages.domainId, domains.id)))
      .innerJoin(pagePublications, eq(pagePublications.pageId, landingPages.id))
      .innerJoin(pageVersions, eq(pageVersions.id, pagePublications.versionId))
      .where(and(eq(domains.hostname, normalized), eq(domains.status, "verified"), eq(brands.status, "active"), eq(landingPages.status, "draft")));
  } finally { await client.end(); }
}
