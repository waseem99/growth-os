import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageRenderer, pageDocumentSchema, pageSeoSchema, type BrandRenderTheme } from "@growth-os/page-engine";
import { resolvePublishedPage } from "../../lib/brand-resolution";
import { resolveExperimentVariant } from "../../lib/experiment-resolution";
import { resolvePageAssets } from "../../lib/page-assets";
import { canonicalFor } from "../../lib/public-seo";
import { GrowthTracker } from "../growth-tracker";
import { renderPublicMedia } from "../public-media";

export const revalidate = 60;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RouteProps = { params: Promise<{ slug: string[] }>; searchParams: SearchParams };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

async function getRouteSnapshot(params: RouteProps["params"], searchParams: RouteProps["searchParams"]) {
  const [{ slug }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const host = requestHeaders.get("host") ?? "";
  const page = await resolvePublishedPage(host, slug.join("/"));
  if (!page) return null;
  const testTraffic = one(query.go_test) === "1";
  const forcedVariantId = testTraffic ? one(query.go_variant) || null : null;
  const visitor = requestHeaders.get("x-growthos-visitor") ?? `fallback:${page.pageId}`;
  const experiment = await resolveExperimentVariant(page.pageId, visitor, forcedVariantId);
  return {
    page,
    content: experiment?.content ?? page.content,
    seo: experiment?.seo ?? page.seo,
    versionId: experiment?.versionId ?? page.versionId,
    offer: experiment?.offer ?? page.offer,
    campaignId: experiment?.campaignId ?? page.campaignId,
    experimentId: experiment?.experimentId ?? null,
    variantId: experiment?.variantId ?? null,
    testTraffic: Boolean(testTraffic && experiment)
  };
}

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const snapshot = await getRouteSnapshot(params, searchParams);
  if (!snapshot) return { title: "Not found", robots: { index: false, follow: false } };
  const { page } = snapshot;
  const seo = pageSeoSchema.safeParse(snapshot.seo);
  const baseSeo = pageSeoSchema.safeParse(page.seo);
  if (!seo.success || !baseSeo.success) return { title: page.pageName, robots: { index: false, follow: false } };
  const canonical = canonicalFor(baseSeo.data, page.hostname, page.slug);
  const parsed = pageDocumentSchema.safeParse(snapshot.content);
  const socialId = seo.data.socialAssetId ?? page.defaultSocialAssetId;
  const assetMap = parsed.success ? await resolvePageAssets(parsed.data, [socialId]) : new Map();
  const social = assetMap.get(socialId ?? "");
  const canIndex = seo.data.index && !snapshot.testTraffic && !page.platformAlias;
  return {
    title: seo.data.title,
    description: seo.data.description,
    alternates: { canonical },
    robots: { index: canIndex, follow: canIndex },
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

export default async function PublishedPage({ params, searchParams }: RouteProps) {
  const snapshot = await getRouteSnapshot(params, searchParams);
  if (!snapshot) notFound();
  const { page } = snapshot;
  const parsed = pageDocumentSchema.safeParse(snapshot.content);
  const seo = pageSeoSchema.safeParse(snapshot.seo);
  if (!parsed.success || !seo.success) notFound();
  const assetMap = await resolvePageAssets(parsed.data, [seo.data.socialAssetId ?? page.defaultSocialAssetId]);
  const structuredData = Object.keys(seo.data.structuredData).length ? seo.data.structuredData : null;
  return <>
    {structuredData ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /> : null}
    <PageRenderer document={parsed.data} theme={page.theme as BrandRenderTheme} offer={snapshot.offer} renderMedia={renderPublicMedia(assetMap)} />
    <GrowthTracker context={{ brandId: page.brandId, campaignId: snapshot.campaignId, pageId: page.pageId, versionId: snapshot.versionId, variantId: snapshot.variantId, experimentId: snapshot.experimentId, testTraffic: snapshot.testTraffic, defaultUtm: page.campaignUtmDefaults }} />
  </>;
}
