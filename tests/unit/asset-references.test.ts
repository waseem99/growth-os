import { describe, expect, it } from "vitest";
import { pageDocumentSchema, skillupCleanReference } from "@growth-os/page-engine";
import { collectAssetReferences, normalizeTags, replaceAssetReference } from "../../apps/admin/lib/asset-references";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

describe("asset references", () => {
  it("collects stable field paths and replaces only asset IDs", () => {
    const document = pageDocumentSchema.parse(structuredClone(skillupCleanReference));
    const hero = document.blocks.find((block) => block.type === "hero");
    if (!hero || hero.type !== "hero") throw new Error("hero missing");
    hero.heroAssetId = first;
    hero.backgroundAssetId = first;
    const references = collectAssetReferences(document);
    expect(references).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: first, fieldPath: expect.stringContaining("heroAssetId") }),
      expect.objectContaining({ assetId: first, fieldPath: expect.stringContaining("backgroundAssetId") })
    ]));
    const replaced = replaceAssetReference(document, first, second);
    expect(collectAssetReferences(replaced).every((reference) => reference.assetId !== first)).toBe(true);
    expect(collectAssetReferences(replaced).filter((reference) => reference.assetId === second)).toHaveLength(2);
  });

  it("normalizes and deduplicates tags", () => {
    expect(normalizeTags(" Meta,hero, META,  Ramadan ")).toEqual(["meta", "hero", "ramadan"]);
  });
});
