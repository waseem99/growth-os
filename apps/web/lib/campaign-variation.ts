import { pageDocumentSchema, type PageDocument } from "@growth-os/page-engine";

export type VariationCreative = {
  bannerAssetId: string | null;
  copyOverrides: Record<string, unknown>;
};

/** Overlay only an approved hero asset and bounded text; never execute raw HTML/JS. */
export function applyPublishedVariation(document: unknown, variation: VariationCreative | null): PageDocument {
  const original = pageDocumentSchema.parse(document);
  if (!variation) return original;
  const override = variation.copyOverrides;
  const headline = typeof override.headline === "string" && override.headline.trim() ? override.headline : null;
  const subheadline = typeof override.subheadline === "string" && override.subheadline.trim() ? override.subheadline : null;
  const blocks = original.blocks.map((block) => {
    if (block.type !== "hero") return block;
    return {
      ...block,
      ...(variation.bannerAssetId ? { heroAssetId: variation.bannerAssetId } : {}),
      ...(headline ? { headline } : {}),
      ...(subheadline ? { subheadline } : {})
    };
  });
  return pageDocumentSchema.parse({ ...original, blocks });
}
