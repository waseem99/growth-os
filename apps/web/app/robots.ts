import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { normalizeRequestHost } from "../lib/brand-resolution";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = normalizeRequestHost((await headers()).get("host"));
  const protocol = host === "localhost" || host.endsWith(".localhost") ? "http" : "https";

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: host ? `${protocol}://${host}/sitemap.xml` : undefined
  };
}
