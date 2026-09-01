import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageRenderer, pageDocumentSchema, type BrandRenderTheme, type OfferSnapshot } from "@growth-os/page-engine";
import { resolvePublishedPage } from "../../lib/brand-resolution";

export default async function PublishedPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params; const host = (await headers()).get("host") ?? ""; const page = await resolvePublishedPage(host, slug.join("/")); if (!page) notFound();
  const parsed = pageDocumentSchema.safeParse(page.content); if (!parsed.success) return <main><section><p className="eyebrow">{page.brandName}</p><h1>Page configuration needs migration.</h1><p>This publication predates the active GrowthOS page schema.</p></section></main>;
  return <PageRenderer document={parsed.data} theme={page.theme as BrandRenderTheme} offer={(page as unknown as { offer?: OfferSnapshot }).offer} />;
}
