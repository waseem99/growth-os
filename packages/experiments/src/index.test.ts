import { describe, expect, it } from "vitest";
import { chooseVariant, experimentVariantsSchema, stableBucket } from "./index";

const experimentId = "00000000-0000-4000-8000-000000000900";
const variants = [
  { id: "00000000-0000-4000-8000-000000000901", name: "Control", pageVersionId: "00000000-0000-4000-8000-000000000051", allocation: 50, isControl: true },
  { id: "00000000-0000-4000-8000-000000000902", name: "Variant B", pageVersionId: "00000000-0000-4000-8000-000000000052", allocation: 50, isControl: false }
];

describe("experiments", () => {
  it("requires exactly 100 percent allocation and one control", () => {
    expect(experimentVariantsSchema.safeParse(variants).success).toBe(true);
    expect(experimentVariantsSchema.safeParse(variants.map((variant) => ({ ...variant, allocation: 40 }))).success).toBe(false);
    expect(experimentVariantsSchema.safeParse(variants.map((variant) => ({ ...variant, isControl: false }))).success).toBe(false);
  });

  it("keeps the same visitor on the same variant", () => {
    const first = chooseVariant(variants, "visitor-123", experimentId);
    for (let index = 0; index < 20; index += 1) expect(chooseVariant(variants, "visitor-123", experimentId).id).toBe(first.id);
    expect(stableBucket("visitor-123", experimentId)).toBe(stableBucket("visitor-123", experimentId));
  });

  it("approximates configured weights over deterministic visitors", () => {
    let control = 0;
    const count = 10_000;
    for (let index = 0; index < count; index += 1) if (chooseVariant(variants, `visitor-${index}`, experimentId).isControl) control += 1;
    const ratio = control / count;
    expect(ratio).toBeGreaterThan(0.47);
    expect(ratio).toBeLessThan(0.53);
  });
});
