import type { AiPageBrief } from "./contracts";
import type { PageBlock, PageDocument, PageSeo } from "@growth-os/page-engine";
import { editableTextPaths } from "./compose";

const SYSTEM = `You are GrowthOS's marketing copy assistant. Return only the requested structured output. Never invent payment API behavior, legal guarantees, performance statistics, endorsements, coupon values, eligibility rules, or product facts that were not provided. Keep claims grounded in the supplied context. Do not output HTML, JavaScript, CSS, markdown, secrets or credentials. Prefer concise mobile-first acquisition copy.`;

const safeJson = (value: unknown) => JSON.stringify(value, (_key, entry) => {
  if (typeof entry === "string" && entry.length > 2500) return `${entry.slice(0, 2500)}…`;
  return entry;
}, 2).slice(0, 18_000);

export function pageGenerationPrompt(brief: AiPageBrief) {
  return {
    system: SYSTEM,
    user: `Create conversion-focused copy for a controlled GrowthOS landing-page template.\n\nBrief:\n${safeJson(brief)}\n\nUse only supplied offer/product facts. The page will be composed and schema-validated by GrowthOS. FAQ answers must not invent policies.`
  };
}

export function blockRewritePrompt(input: { block: PageBlock; instruction: string; context?: Record<string, unknown> }) {
  return {
    system: SYSTEM,
    user: `Rewrite only textual copy in the supplied block. Return changes only for the allowed paths. Do not change links, assets, provider, variant, visibility, IDs, block type or configuration.\n\nInstruction: ${input.instruction.slice(0, 1200)}\nAllowed paths: ${editableTextPaths(input.block).join(", ")}\nBlock:\n${safeJson(input.block)}\nContext:\n${safeJson(input.context ?? {})}`
  };
}

export function variantsPrompt(input: { document: PageDocument; direction?: string; context?: Record<string, unknown> }) {
  const hero = input.document.blocks.find((block) => block.type === "hero");
  const ctas = input.document.blocks.filter((block) => block.type === "cta" || block.type === "form" || block.type === "stickyCta");
  return {
    system: SYSTEM,
    user: `Create 2-3 meaningfully differentiated positioning/copy variants. Vary the marketing angle, not product facts. Keep each suitable for an A/B page version.\nDirection: ${(input.direction ?? "Test distinct value propositions").slice(0, 800)}\nCurrent hero: ${safeJson(hero)}\nCurrent CTA blocks: ${safeJson(ctas)}\nContext: ${safeJson(input.context ?? {})}`
  };
}

export function seoPrompt(input: { document: PageDocument; seo: PageSeo; context?: Record<string, unknown> }) {
  return {
    system: SYSTEM,
    user: `Suggest SEO and social metadata for this landing page. Stay within schema character limits. Do not invent claims.\nCurrent SEO: ${safeJson(input.seo)}\nVisible page copy: ${safeJson(input.document.blocks.filter((block) => block.visible))}\nContext: ${safeJson(input.context ?? {})}`
  };
}

export function faqPrompt(input: { document: PageDocument; context?: Record<string, unknown> }) {
  return {
    system: SYSTEM,
    user: `Suggest 3-8 concise FAQs that reduce real conversion friction. Answer only from provided context/page copy. If a policy or detail is unknown, say the visitor should check the configured terms/support rather than inventing it.\nPage: ${safeJson(input.document.blocks.filter((block) => block.visible))}\nContext: ${safeJson(input.context ?? {})}`
  };
}

export function assetMetadataPrompt(input: { filename?: string | null; mimeType: string; width?: number | null; height?: number | null; currentTitle?: string | null; currentAltText?: string | null; context?: string }) {
  return {
    system: SYSTEM,
    user: `Suggest useful asset-library metadata from the supplied file/context information only. Do not claim to visually inspect pixels because no image bytes are provided. Alt text should describe the asset's intended/contextual meaning based on supplied context; avoid keyword stuffing.\nAsset: ${safeJson(input)}`
  };
}
