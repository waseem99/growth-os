import { z } from "zod";

export const experimentVariantInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  pageVersionId: z.string().uuid(),
  allocation: z.number().int().min(0).max(100),
  isControl: z.boolean()
});

export const experimentVariantsSchema = z.array(experimentVariantInputSchema).min(2).max(10).superRefine((variants, ctx) => {
  const total = variants.reduce((sum, variant) => sum + variant.allocation, 0);
  if (total !== 100) ctx.addIssue({ code: "custom", message: `Variant allocation must total 100%, got ${total}%` });
  if (variants.filter((variant) => variant.isControl).length !== 1) ctx.addIssue({ code: "custom", message: "Exactly one control variant is required" });
  if (new Set(variants.map((variant) => variant.id)).size !== variants.length) ctx.addIssue({ code: "custom", message: "Variant IDs must be unique" });
});

export type ExperimentVariantInput = z.infer<typeof experimentVariantInputSchema>;

export function stableBucket(visitorKey: string, experimentId: string) {
  const input = `${experimentId}:${visitorKey}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 10_000;
}

export function chooseVariant(variants: readonly ExperimentVariantInput[], visitorKey: string, experimentId: string): ExperimentVariantInput {
  const parsed = experimentVariantsSchema.parse(variants);
  const bucket = stableBucket(visitorKey, experimentId) / 100;
  let cursor = 0;
  for (const variant of parsed) {
    cursor += variant.allocation;
    if (bucket < cursor) return variant;
  }
  const fallback = parsed.find((variant) => variant.isControl) ?? parsed.at(0);
  if (!fallback) throw new Error("EXPERIMENT_HAS_NO_VARIANTS");
  return fallback;
}

export function controlVariant(variants: readonly ExperimentVariantInput[]) {
  return variants.find((variant) => variant.isControl) ?? null;
}
