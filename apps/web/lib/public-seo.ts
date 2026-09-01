import type { PageSeo } from "@growth-os/page-engine";

export function publicOrigin(hostname: string) {
  const host = hostname.trim().toLowerCase();
  const protocol = host === "localhost" || host.endsWith(".localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export function canonicalFor(seo: PageSeo, hostname: string, slug: string) {
  return seo.canonicalUrl ?? `${publicOrigin(hostname)}/${slug.replace(/^\/+/, "")}`;
}

export function shouldListInSitemap(seo: PageSeo) {
  return seo.index === true;
}
