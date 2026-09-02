import { describe, expect, it } from "vitest";
import { pageDocumentSchema } from "@growth-os/page-engine";
import { applyAdCreative, instantiatePageTemplate, normalizePageSlug, reseedPageDocument } from "../../apps/admin/lib/page-input";

describe("page lifecycle helpers", () => {
  it("instantiates valid independent template documents", () => {
    const first = instantiatePageTemplate("subscription-acquisition");
    const second = instantiatePageTemplate("subscription-acquisition");
    expect(pageDocumentSchema.parse(first)).toBeTruthy();
    expect(first.blocks.map((block) => block.type)).toEqual(second.blocks.map((block) => block.type));
    expect(first.blocks[0]?.id).not.toBe(second.blocks[0]?.id);
  });

  it("reseeds nested block and item IDs for duplication", () => {
    const source = instantiatePageTemplate("subscription-acquisition");
    const copy = reseedPageDocument(source);
    expect(copy.blocks[0]?.id).not.toBe(source.blocks[0]?.id);
    const sourceBenefits = source.blocks.find((block) => block.type === "benefits");
    const copyBenefits = copy.blocks.find((block) => block.type === "benefits");
    expect(copyBenefits?.items[0]?.id).not.toBe(sourceBenefits?.items[0]?.id);
  });

  it("seeds the landing-page hero and CTA from the saved ad creative", () => {
    const source = instantiatePageTemplate("subscription-acquisition");
    const creativeAssetId = "11111111-1111-4111-8111-111111111111";
    const next = applyAdCreative(source, { assetId: creativeAssetId, headline: "Same headline as Meta", primaryText: "Same primary ad message", cta: "Get offer" });
    const hero = next.blocks.find((block) => block.type === "hero");
    expect(hero?.headline).toBe("Same headline as Meta");
    expect(hero?.subheadline).toBe("Same primary ad message");
    expect(hero?.heroAssetId).toBe(creativeAssetId);
    const subscription = next.blocks.find((block) => block.type === "form" && block.variant === "subscription");
    expect(subscription?.ctaLabel).toBe("Get offer");
  });

  it("normalizes safe predictable slugs", () => {
    expect(normalizePageSlug("  Learn AI / September!  ")).toBe("learn-ai-september");
  });
});
