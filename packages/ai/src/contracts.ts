import { z } from "zod";

export const aiTemplateKeySchema = z.enum(["subscription-acquisition", "content-acquisition", "game-acquisition"]);
export const aiStylePresetSchema = z.enum(["clean-light", "premium-purple", "campaign-dark", "promotion", "minimal"]);

export const aiPageBriefSchema = z.object({
  brandName: z.string().trim().min(1).max(120),
  productName: z.string().trim().min(1).max(160),
  platform: z.string().trim().min(1).max(80),
  audience: z.string().trim().min(1).max(500),
  offer: z.string().trim().min(1).max(700),
  conversionGoal: z.string().trim().min(1).max(120),
  tone: z.string().trim().min(1).max(240),
  positioning: z.string().trim().min(1).max(600),
  templateKey: aiTemplateKeySchema,
  stylePreset: aiStylePresetSchema.optional(),
  locale: z.string().trim().min(2).max(20).default("en-PK")
});

const copyItemSchema = z.object({
  title: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(280)
});

export const generatedPageCopySchema = z.object({
  pageName: z.string().trim().min(2).max(120),
  hero: z.object({
    eyebrow: z.string().trim().max(80),
    headline: z.string().trim().min(8).max(150),
    highlightedText: z.string().trim().max(80),
    subheadline: z.string().trim().min(12).max(360),
    promoHeadline: z.string().trim().max(140),
    promoSubheadline: z.string().trim().max(160)
  }),
  benefits: z.array(copyItemSchema).min(3).max(6),
  showcase: z.object({
    title: z.string().trim().min(2).max(120),
    intro: z.string().trim().max(240),
    items: z.array(copyItemSchema).min(2).max(6)
  }),
  cta: z.object({
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().max(280),
    label: z.string().trim().min(2).max(60)
  }),
  faq: z.array(z.object({
    question: z.string().trim().min(4).max(180),
    answer: z.string().trim().min(8).max(700)
  })).min(3).max(8),
  seo: z.object({
    title: z.string().trim().min(10).max(70),
    description: z.string().trim().min(40).max(180),
    socialTitle: z.string().trim().max(95),
    socialDescription: z.string().trim().max(200)
  })
});

export const blockRewriteSuggestionSchema = z.object({
  summary: z.string().trim().min(2).max(220),
  changes: z.array(z.object({
    path: z.string().trim().min(1).max(120),
    value: z.string().trim().max(1200)
  })).min(1).max(20)
});

export const copyVariantsSuggestionSchema = z.object({
  variants: z.array(z.object({
    name: z.string().trim().min(2).max(80),
    angle: z.string().trim().min(2).max(180),
    headline: z.string().trim().min(8).max(150),
    subheadline: z.string().trim().min(12).max(360),
    ctaLabel: z.string().trim().min(2).max(60)
  })).min(2).max(3)
});

export const seoSuggestionSchema = z.object({
  title: z.string().trim().min(10).max(70),
  description: z.string().trim().min(40).max(180),
  socialTitle: z.string().trim().max(95),
  socialDescription: z.string().trim().max(200)
});

export const faqSuggestionSchema = z.object({
  title: z.string().trim().min(2).max(120).default("Frequently Asked Questions"),
  items: z.array(z.object({
    question: z.string().trim().min(4).max(180),
    answer: z.string().trim().min(8).max(700)
  })).min(3).max(8)
});

export const assetMetadataSuggestionSchema = z.object({
  title: z.string().trim().min(2).max(140),
  altText: z.string().trim().min(2).max(180),
  tags: z.array(z.string().trim().min(1).max(40)).min(2).max(12)
});

export const qualityFindingSchema = z.object({
  severity: z.enum(["error", "warning", "suggestion"]),
  code: z.string().trim().min(2).max(80),
  path: z.string().trim().max(180),
  message: z.string().trim().min(2).max(500),
  suggestion: z.string().trim().max(500)
});

export const qualityReportSchema = z.object({
  score: z.number().int().min(0).max(100),
  findings: z.array(qualityFindingSchema).max(80)
});

export const AI_ACTIONS = [
  "generate_page",
  "rewrite_block",
  "generate_variants",
  "suggest_seo",
  "suggest_faq",
  "suggest_asset_metadata",
  "quality_check"
] as const;

export type AiPageBrief = z.infer<typeof aiPageBriefSchema>;
export type GeneratedPageCopy = z.infer<typeof generatedPageCopySchema>;
export type BlockRewriteSuggestion = z.infer<typeof blockRewriteSuggestionSchema>;
export type CopyVariantsSuggestion = z.infer<typeof copyVariantsSuggestionSchema>;
export type SeoSuggestion = z.infer<typeof seoSuggestionSchema>;
export type FaqSuggestion = z.infer<typeof faqSuggestionSchema>;
export type AssetMetadataSuggestion = z.infer<typeof assetMetadataSuggestionSchema>;
export type QualityReport = z.infer<typeof qualityReportSchema>;
export type AiAction = (typeof AI_ACTIONS)[number];
