import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  assets, brands, getDatabase, landingPages, landingVariations, landingVariationVersions,
  offers, offerVersions, productPackages
} from "@growth-os/db";
import { applyPublishedVariation, collectAssetIds, PageRenderer, type BrandRenderTheme, type OfferSnapshot } from "@growth-os/page-engine";
import { requirePermission } from "@/lib/user-access";

export const metadata = { title: "GrowthOS variation draft preview", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ package?: string }> };

export default async function VariationDraftPreview({ params, searchParams }: Props) {
  await requirePermission("pages:manage");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { db, client } = getDatabase();
  try {
    const [row] = await db.select({
      id: landingVariations.id, brandId: landingVariations.brandId, parameterKey: landingVariations.parameterKey,
      pageId: landingPages.id, pageName: landingPages.name, pageContent: landingPages.draftContent,
      brandName: brands.name, theme: brands.theme
    }).from(landingVariations).innerJoin(landingPages, eq(landingPages.id, landingVariations.pageId))
      .innerJoin(brands, eq(brands.id, landingVariations.brandId))
      .where(eq(landingVariations.id, id)).limit(1);
    if (!row) notFound();
    const [latest] = await db.select({
      bannerAssetId: landingVariationVersions.bannerAssetId, overrides: landingVariationVersions.copyOverrides,
      number: landingVariationVersions.versionNumber
    }).from(landingVariationVersions).where(eq(landingVariationVersions.variationId, id))
      .orderBy(desc(landingVariationVersions.versionNumber)).limit(1);
    if (!latest) notFound();

    let document;
    try {
      document = applyPublishedVariation(row.pageContent, { bannerAssetId: latest.bannerAssetId, copyOverrides: latest.overrides });
    } catch {
      notFound();
    }

    let offer: OfferSnapshot | undefined;
    if (query.package) {
      const [pkg] = await db.select({
        currency: offerVersions.currency, initialAmount: offerVersions.initialAmount,
        recurringAmount: offerVersions.recurringAmount, billingInterval: offerVersions.billingInterval,
        trialDays: offerVersions.trialDays, autoRenew: offerVersions.autoRenew
      }).from(productPackages).innerJoin(offerVersions, eq(offerVersions.id, productPackages.offerVersionId))
        .innerJoin(offers, eq(offers.id, offerVersions.offerId))
        .where(and(eq(productPackages.brandId, row.brandId), eq(offers.brandId, row.brandId),
          eq(productPackages.packageCode, query.package), eq(productPackages.status, "active"))).limit(1);
      if (!pkg) notFound();
      offer = pkg;
    }

    const ids = collectAssetIds(document);
    const mediaRows = ids.length ? await db.select({ id: assets.id, url: assets.storageKey })
      .from(assets).where(and(eq(assets.brandId, row.brandId), inArray(assets.id, ids))) : [];
    const urls = new Map(mediaRows.map((asset) => [asset.id, asset.url]));
    return <main className="shell">
      <section className="settings-card">
        <p className="eyebrow">Private draft preview · not a public link</p>
        <h1>{row.brandName} · {row.pageName}</h1>
        <p>Variation <code>{row.parameterKey}</code> · Draft version {latest.number}. This is not published and does not fire live campaign tracking.</p>
        <Link href="/variations">Return to variations</Link>
      </section>
      <PageRenderer document={document} theme={row.theme as BrandRenderTheme} offer={offer} resolveAsset={(assetId) => urls.get(assetId)} />
    </main>;
  } finally { await client.end(); }
}
