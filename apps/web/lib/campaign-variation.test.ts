import { describe, expect, it } from "vitest";
import { applyPublishedVariation } from "./campaign-variation";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = {
  schemaVersion: 1, templateKey: "minimal", stylePreset: "minimal",
  blocks: [
    { id: id(1), type: "hero", version: 1, visible: true, variant: "clean", eyebrow: "", headline: "Original",
      subheadline: "Original details", highlightedText: "", heroAssetId: null,
      backgroundAssetId: null, partnerLogoAssetId: null, promoHeadline: "", promoSubheadline: "" },
    { id: id(2), type: "footer", version: 1, visible: true, secureText: "", privacyText: "", supportText: "", legalText: "" }
  ]
};

describe("safe multi-product creative overlay", () => {
  it("preserves the original document when no variation is selected", () => {
    expect(applyPublishedVariation(base, null).blocks[0]).toMatchObject({ headline: "Original", heroAssetId: null });
  });
  it("applies only approved hero content", () => {
    const result = applyPublishedVariation(base, { bannerAssetId: id(100), copyOverrides: {
      headline: "Ranchers campaign", subheadline: "PKR pricing comes from the selected package", arbitraryHtml: "<script/>"
    } });
    expect(result.blocks[0]).toMatchObject({ headline: "Ranchers campaign", heroAssetId: id(100) });
    expect(result.blocks[1]?.type).toBe("footer");
    expect(JSON.stringify(result)).not.toContain("arbitraryHtml");
  });
  it("ignores empty overrides instead of wiping approved copy", () => {
    expect(applyPublishedVariation(base, { bannerAssetId: null, copyOverrides: { headline: " " } }).blocks[0])
      .toMatchObject({ headline: "Original" });
  });
  it("rejects invalid content with existing page schema validation", () => {
    expect(() => applyPublishedVariation(base, { bannerAssetId: id(100), copyOverrides: { headline: "X".repeat(300) } })).toThrow();
  });
});
