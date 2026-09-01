import { z } from "zod";

export const pageSeoSchema = z.object({
  title: z.string().trim().min(10).max(70),
  description: z.string().trim().min(40).max(180),
  index: z.boolean().default(true),
  canonicalUrl: z.string().url().max(500).nullable().default(null),
  socialAssetId: z.string().uuid().nullable().default(null),
  socialTitle: z.string().trim().max(95).default(""),
  socialDescription: z.string().trim().max(200).default(""),
  structuredData: z.record(z.string(), z.unknown()).default({})
});

export type PageSeo = z.infer<typeof pageSeoSchema>;

export const defaultPageSeo = (name: string): PageSeo => ({
  title: `${name} | GrowthOS`.slice(0, 70).padEnd(Math.min(10, `${name} | GrowthOS`.length), " "),
  description: `Discover ${name} and take the next step with this official campaign experience.`.padEnd(40, ".").slice(0, 180),
  index: true,
  canonicalUrl: null,
  socialAssetId: null,
  socialTitle: "",
  socialDescription: "",
  structuredData: {}
});
