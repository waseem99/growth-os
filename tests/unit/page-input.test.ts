import { describe, expect, it } from "vitest";
import { pageDocumentSchema } from "@growth-os/page-engine";
import { instantiatePageTemplate, normalizePageSlug, reseedPageDocument } from "../../apps/admin/lib/page-input";

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

  it("normalizes safe predictable slugs", () => {
    expect(normalizePageSlug("  Learn AI / September!  ")).toBe("learn-ai-september");
  });
});
