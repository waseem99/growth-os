import { and, eq } from "drizzle-orm";
import {
  getDatabase, landingVariations, landingVariationPublications, landingVariationVersions,
  offers, offerVersions, productPackages
} from "@growth-os/db";
import type { OfferSnapshot } from "@growth-os/page-engine";

export type PublishedVariation = {
  id: string;
  versionId: string;
  bannerAssetId: string | null;
  copyOverrides: Record<string, unknown>;
  campaignId: string | null;
};
export type CampaignOverlay = {
  validPackage: boolean;
  variation: PublishedVariation | null;
  packageId: string | null;
  packageCode: string | null;
  offer: OfferSnapshot | null;
};

export async function resolvePublishedCampaignOverlay(input: {
  brandId: string;
  pageId: string;
  variationKey: string | null;
  packageCode: string | null;
}): Promise<CampaignOverlay> {
  if (!input.variationKey && !input.packageCode) {
    return { validPackage: true, variation: null, packageId: null, packageCode: null, offer: null };
  }
  const { db, client } = getDatabase();
  try {
    const [variation, selectedPackage] = await Promise.all([
      input.variationKey ? db.select({
        id: landingVariations.id,
        versionId: landingVariationVersions.id,
        bannerAssetId: landingVariationVersions.bannerAssetId,
        copyOverrides: landingVariationVersions.copyOverrides,
        campaignId: landingVariations.campaignId
      }).from(landingVariations)
        .innerJoin(landingVariationPublications, eq(landingVariationPublications.variationId, landingVariations.id))
        .innerJoin(landingVariationVersions, eq(landingVariationVersions.id, landingVariationPublications.versionId))
        .where(and(
          eq(landingVariations.brandId, input.brandId),
          eq(landingVariations.pageId, input.pageId),
          eq(landingVariations.parameterKey, input.variationKey),
          eq(landingVariations.status, "active")
        )).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null),
      input.packageCode ? db.select({
        id: productPackages.id, code: productPackages.packageCode,
        currency: offerVersions.currency, initialAmount: offerVersions.initialAmount,
        recurringAmount: offerVersions.recurringAmount, billingInterval: offerVersions.billingInterval,
        trialDays: offerVersions.trialDays, autoRenew: offerVersions.autoRenew
      }).from(productPackages)
        .innerJoin(offerVersions, eq(offerVersions.id, productPackages.offerVersionId))
        .innerJoin(offers, eq(offers.id, offerVersions.offerId))
        .where(and(
          eq(productPackages.brandId, input.brandId),
          eq(offers.brandId, input.brandId),
          eq(productPackages.packageCode, input.packageCode),
          eq(productPackages.status, "active"),
          eq(offers.status, "active")
        )).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null)
    ]);
    return {
      validPackage: !input.packageCode || Boolean(selectedPackage),
      variation: variation ? {
        id: variation.id, versionId: variation.versionId, campaignId: variation.campaignId,
        bannerAssetId: variation.bannerAssetId,
        copyOverrides: variation.copyOverrides
      } : null,
      packageId: selectedPackage?.id ?? null,
      packageCode: selectedPackage?.code ?? null,
      offer: selectedPackage ? {
        currency: selectedPackage.currency,
        initialAmount: selectedPackage.initialAmount,
        recurringAmount: selectedPackage.recurringAmount,
        billingInterval: selectedPackage.billingInterval,
        trialDays: selectedPackage.trialDays,
        autoRenew: selectedPackage.autoRenew
      } : null
    };
  } finally { await client.end(); }
}
