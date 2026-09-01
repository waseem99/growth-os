import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { pageSeoSchema } from "@growth-os/page-engine";
import { listPublishedPagesForHost, normalizeRequestHost } from "../lib/brand-resolution";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = normalizeRequestHost((await headers()).get("host"));
  if (!host) return [];
  const protocol = host === "localhost" || host.endsWith(".localhost") ? "http" : "https";
  const pages = await listPublishedPagesForHost(host);
  return pages.flatMap((page) => {
    const seo = pageSeoSchema.safeParse(page.seo);
    if (!seo.success || !seo.data.index) return [];
    return [{ url: seo.data.canonicalUrl ?? `${protocol}://${host}/${page.slug}`, lastModified: page.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 }];
  });
}
