import { describe, expect, it } from "vitest";
import { pageDocumentSchema, skillupCleanReference, skillupRanchersReference, starterTemplates } from "@growth-os/page-engine";

describe("GrowthOS page engine", () => {
  it("validates every starter template", () => { for (const template of starterTemplates) expect(pageDocumentSchema.parse(template.document)).toBeTruthy(); });
  it("models both SkillUp references with one template and identical block structure", () => {
    const clean = pageDocumentSchema.parse(skillupCleanReference); const promo = pageDocumentSchema.parse(skillupRanchersReference);
    expect(clean.templateKey).toBe("subscription-acquisition"); expect(promo.templateKey).toBe(clean.templateKey);
    expect(clean.blocks.map((b) => b.type)).toEqual(promo.blocks.map((b) => b.type));
    expect(clean.stylePreset).not.toBe(promo.stylePreset);
    expect(clean.blocks.find((b) => b.type === "hero")?.variant).toBe("clean");
    expect(promo.blocks.find((b) => b.type === "hero")?.variant).toBe("promotional");
  });
  it("rejects arbitrary block types and duplicate IDs", () => {
    expect(() => pageDocumentSchema.parse({ schemaVersion: 1, templateKey: "x", stylePreset: "minimal", blocks: [{ id: crypto.randomUUID(), type: "html", visible: true, html: "<script/>" }] })).toThrow();
    const invalid = structuredClone(skillupCleanReference); invalid.blocks[1]!.id = invalid.blocks[0]!.id; expect(() => pageDocumentSchema.parse(invalid)).toThrow();
  });
});
