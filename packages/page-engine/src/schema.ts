import { z } from "zod";

const id = z.string().uuid();
const assetId = id.nullable().optional();
const base = { id, visible: z.boolean().default(true) };
const item = z.object({ id, title: z.string().min(1).max(120), text: z.string().max(500).default(""), iconAssetId: assetId });

export const headerBlockSchema = z.object({ ...base, type: z.literal("header"), logoAssetId: assetId, badge: z.string().max(80).default(""), trustText: z.string().max(160).default("") });
export const heroBlockSchema = z.object({ ...base, type: z.literal("hero"), variant: z.enum(["clean","promotional","product","minimal"]), eyebrow: z.string().max(100).default(""), headline: z.string().min(1).max(180), highlightedText: z.string().max(100).default(""), subheadline: z.string().max(500).default(""), heroAssetId: assetId, backgroundAssetId: assetId, partnerLogoAssetId: assetId, promoHeadline: z.string().max(160).default(""), promoSubheadline: z.string().max(160).default("") });
export const benefitsBlockSchema = z.object({ ...base, type: z.literal("benefits"), variant: z.enum(["inline","cards","icons"]), items: z.array(item).min(1).max(8) });
export const showcaseBlockSchema = z.object({ ...base, type: z.literal("showcase"), title: z.string().min(1).max(140), intro: z.string().max(500).default(""), items: z.array(item).min(1).max(12) });
export const socialProofBlockSchema = z.object({ ...base, type: z.literal("socialProof"), title: z.string().max(140).default(""), items: z.array(item).min(1).max(12) });
export const stepsBlockSchema = z.object({ ...base, type: z.literal("steps"), title: z.string().min(1).max(140), items: z.array(item).min(2).max(8) });
export const pricingBlockSchema = z.object({ ...base, type: z.literal("pricing"), title: z.string().min(1).max(140), body: z.string().max(500).default(""), ctaLabel: z.string().min(1).max(80) });
export const comparisonBlockSchema = z.object({ ...base, type: z.literal("comparison"), title: z.string().min(1).max(140), items: z.array(item).min(2).max(10) });
export const statsBlockSchema = z.object({ ...base, type: z.literal("stats"), items: z.array(z.object({ id, value: z.string().min(1).max(40), label: z.string().min(1).max(100) })).min(1).max(8) });
export const galleryBlockSchema = z.object({ ...base, type: z.literal("gallery"), title: z.string().max(140).default(""), assets: z.array(z.object({ id, assetId, alt: z.string().max(180).default("") })).min(1).max(12) });
export const videoBlockSchema = z.object({ ...base, type: z.literal("video"), title: z.string().max(140).default(""), assetId, posterAssetId: assetId, caption: z.string().max(300).default("") });
export const faqBlockSchema = z.object({ ...base, type: z.literal("faq"), title: z.string().min(1).max(140), items: z.array(z.object({ id, question: z.string().min(1).max(240), answer: z.string().min(1).max(1200) })).min(1).max(20) });
export const formBlockSchema = z.object({ ...base, type: z.literal("form"), variant: z.enum(["lead","subscription"]), title: z.string().min(1).max(140), provider: z.enum(["jazzcash","easypaisa","generic"]), inputLabel: z.string().min(1).max(100), placeholder: z.string().max(80).default(""), consentLabel: z.string().max(300).default(""), ctaLabel: z.string().min(1).max(80), disclosure: z.string().max(600).default("") });
export const ctaBlockSchema = z.object({ ...base, type: z.literal("cta"), title: z.string().min(1).max(160), body: z.string().max(400).default(""), ctaLabel: z.string().min(1).max(80), href: z.string().max(500).default("#") });
export const stickyCtaBlockSchema = z.object({ ...base, type: z.literal("stickyCta"), label: z.string().min(1).max(80), href: z.string().max(500).default("#") });
export const footerBlockSchema = z.object({ ...base, type: z.literal("footer"), secureText: z.string().max(140).default(""), privacyText: z.string().max(140).default(""), supportText: z.string().max(140).default(""), legalText: z.string().max(500).default("") });

export const pageBlockSchema = z.discriminatedUnion("type", [headerBlockSchema, heroBlockSchema, benefitsBlockSchema, showcaseBlockSchema, socialProofBlockSchema, stepsBlockSchema, pricingBlockSchema, comparisonBlockSchema, statsBlockSchema, galleryBlockSchema, videoBlockSchema, faqBlockSchema, formBlockSchema, ctaBlockSchema, stickyCtaBlockSchema, footerBlockSchema]);

export const pageDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  templateKey: z.string().min(1).max(100),
  stylePreset: z.enum(["clean-light","premium-purple","campaign-dark","promotion","minimal"]),
  blocks: z.array(pageBlockSchema).min(1).max(40)
}).superRefine((page, ctx) => {
  const ids = new Set<string>();
  for (const block of page.blocks) {
    if (ids.has(block.id)) ctx.addIssue({ code: "custom", path: ["blocks"], message: `Duplicate block id ${block.id}` });
    ids.add(block.id);
  }
});

export type PageDocument = z.infer<typeof pageDocumentSchema>;
export type PageBlock = z.infer<typeof pageBlockSchema>;
export type OfferSnapshot = { currency: string; initialAmount?: string | null; recurringAmount?: string | null; billingInterval?: string | null; trialDays?: number | null; autoRenew?: boolean };
export type BrandRenderTheme = { primary?: string; secondary?: string; background?: string; text?: string; radius?: string; fontFamily?: string };
