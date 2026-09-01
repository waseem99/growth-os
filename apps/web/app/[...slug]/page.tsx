import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageRenderer, pageDocumentSchema, pageSeoSchema, type BrandRenderTheme } from "@growth-os/page-engine";
import { resolvePublishedPage } from "../../lib/brand-resolution";
import { resolvePageAssets } from "../../lib/page-assets";
import { canonicalFor } from "../../lib/public-seo";
import { GrowthTracker } from "../growth-tracker";
import { renderPublicMedia } from "../public-media";

export const revalidate = 60;

type RouteProps = { params: Promise<{ slug: string[] }> };

async function getRoutePage(params: RouteProps["params"]) {
  const { slug } = await params;
  const host = (await headers()).get("host") ?? "";
  return resolvePublishedPage(host, slug.join("/"));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const page = await getRoutePage(params);
  if (!page) return { title: "Not found", robots: { index: false, follow: false } };
  const seo = pageSeoSchema.safeParse(page.seo);
  if (!seo.success) return { title: page.pageName, robots: { index: false, follow: false } };
  const canonical = canonicalFor(seo.data, page.hostname, page.slug);
  const parsed = pageDocumentSchema.safeParse(page.content);
  const socialId = seo.data.socialAssetId ?? page.defaultSocialAssetId;
  const assetMap = parsed.success ? await resolvePageAssets(parsed.data, [socialId]) : new Map();
  const social = assetMap.get(socialId ?? "");
  return {
    title: seo.data.title,
    description: seo.data.description,
    alternates: { canonical },
    robots: { index: seo.data.index, follow: seo.data.index },
    openGraph: {
      type: "website",
      url: canonical,
      title: seo.data.socialTitle || seo.data.title,
      description: seo.data.socialDescription || seo.data.description,
      siteName: page.brandName,
      images: social ? [{ url: social.url, width: social.width ?? undefined, height: social.height ?? undefined, alt: social.altText ?? (seo.data.socialTitle || seo.data.title) }] : undefined
    },
    twitter: {
      card: social ? "summary_large_image" : "summary",
      title: seo.data.socialTitle || seo.data.title,
      description: seo.data.socialDescription || seo.data.description,
      images: social ? [social.url] : undefined
    }
  };
}

export default async function PublishedPage({ params }: RouteProps) {
  const page = await getRoutePage(params);
  if (!page) notFound();
  const parsed = pageDocumentSchema.safeParse(page.content);
  const seo = pageSeoSchema.safeParse(page.seo);
  if (!parsed.success || !seo.success) notFound();
  const assetMap = await resolvePageAssets(parsed.data, [seo.data.socialAssetId ?? page.defaultSocialAssetId]);
  const structuredData = Object.keys(seo.data.structuredData).length ? seo.data.structuredData : null;
  return <>
    {structuredData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /> : null}
    <PageRenderer document={parsed.data} theme={page.theme as BrandRenderTheme} offer={page.offer} renderMedia={renderPublicMedia(assetMap)} />
    <GrowthTracker context={{ brandId: page.brandId, campaignId: page.campaignId, pageId: page.pageId, versionId: page.versionId, defaultUtm: page.campaignUtmDefaults }} />
  </>;
}
