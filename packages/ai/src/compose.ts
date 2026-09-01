import {
  pageBlockSchema,
  pageDocumentSchema,
  pageSeoSchema,
  starterTemplates,
  type PageBlock,
  type PageDocument,
  type PageSeo
} from "@growth-os/page-engine";
import type {
  AiPageBrief,
  BlockRewriteSuggestion,
  CopyVariantsSuggestion,
  FaqSuggestion,
  GeneratedPageCopy,
  SeoSuggestion
} from "./contracts";

const newId = () => globalThis.crypto.randomUUID();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function templateDocument(key: AiPageBrief["templateKey"]) {
  const template = starterTemplates.find((candidate) => candidate.key === key);
  if (!template) throw new Error(`UNKNOWN_AI_TEMPLATE:${key}`);
  return pageDocumentSchema.parse(clone(template.document));
}

export function composeGeneratedPage(brief: AiPageBrief, copy: GeneratedPageCopy): { document: PageDocument; seo: PageSeo } {
  const base = templateDocument(brief.templateKey);
  const faqBlock: PageBlock = {
    id: newId(),
    version: 1,
    type: "faq",
    visible: true,
    title: "Frequently Asked Questions",
    items: copy.faq.map((item) => ({ id: newId(), question: item.question, answer: item.answer }))
  };
  let hasFaq = false;
  const blocks = base.blocks.map((block): PageBlock => {
    if (block.type === "hero") return {
      ...block,
      eyebrow: copy.hero.eyebrow,
      headline: copy.hero.headline,
      highlightedText: copy.hero.highlightedText,
      subheadline: copy.hero.subheadline,
      promoHeadline: copy.hero.promoHeadline,
      promoSubheadline: copy.hero.promoSubheadline
    };
    if (block.type === "benefits") return {
      ...block,
      items: copy.benefits.map((item) => ({ id: newId(), title: item.title, text: item.text, iconAssetId: null }))
    };
    if (block.type === "showcase") return {
      ...block,
      title: copy.showcase.title,
      intro: copy.showcase.intro,
      items: copy.showcase.items.map((item) => ({ id: newId(), title: item.title, text: item.text, iconAssetId: null }))
    };
    if (block.type === "cta") return { ...block, title: copy.cta.title, body: copy.cta.body, ctaLabel: copy.cta.label };
    if (block.type === "form") return { ...block, title: copy.cta.title, ctaLabel: copy.cta.label };
    if (block.type === "stickyCta") return { ...block, label: copy.cta.label };
    if (block.type === "faq") {
      hasFaq = true;
      return { ...faqBlock, id: block.id };
    }
    return block;
  });
  if (!hasFaq) {
    const footerIndex = blocks.findIndex((block) => block.type === "footer");
    if (footerIndex >= 0) blocks.splice(footerIndex, 0, faqBlock);
    else blocks.push(faqBlock);
  }

  const document = pageDocumentSchema.parse({
    ...base,
    stylePreset: brief.stylePreset ?? base.stylePreset,
    blocks
  });
  const seo = pageSeoSchema.parse({
    title: copy.seo.title,
    description: copy.seo.description,
    index: true,
    canonicalUrl: null,
    socialAssetId: null,
    socialTitle: copy.seo.socialTitle,
    socialDescription: copy.seo.socialDescription,
    structuredData: {}
  });
  return { document, seo };
}

const forbiddenCopyKeys = new Set(["id", "type", "version", "visible", "variant", "provider", "href", "assetId", "heroAssetId", "backgroundAssetId", "partnerLogoAssetId", "logoAssetId", "posterAssetId", "iconAssetId"]);

export function editableTextPaths(block: PageBlock): string[] {
  const paths: string[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (typeof value === "string") {
      const key = prefix.split(".").at(-1) ?? "";
      if (!forbiddenCopyKeys.has(key) && !key.endsWith("AssetId")) paths.push(prefix);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, prefix ? `${prefix}.${index}` : String(index)));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) walk(entry, prefix ? `${prefix}.${key}` : key);
    }
  };
  walk(block, "");
  return paths.filter(Boolean);
}

function setStringPath(target: Record<string, unknown>, path: string, value: string) {
  const parts = path.split(".");
  let cursor: unknown = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    if (Array.isArray(cursor)) {
      const arrayIndex = Number(part);
      if (!Number.isInteger(arrayIndex) || !cursor[arrayIndex]) return false;
      cursor = cursor[arrayIndex];
    } else if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[part];
    } else return false;
  }
  const final = parts.at(-1)!;
  if (Array.isArray(cursor)) {
    const arrayIndex = Number(final);
    if (!Number.isInteger(arrayIndex) || typeof cursor[arrayIndex] !== "string") return false;
    cursor[arrayIndex] = value;
    return true;
  }
  if (!cursor || typeof cursor !== "object" || typeof (cursor as Record<string, unknown>)[final] !== "string") return false;
  (cursor as Record<string, unknown>)[final] = value;
  return true;
}

export function applyBlockRewrite(block: PageBlock, suggestion: BlockRewriteSuggestion): PageBlock {
  const allowed = new Set(editableTextPaths(block));
  const draft = clone(block) as unknown as Record<string, unknown>;
  for (const change of suggestion.changes) {
    if (!allowed.has(change.path)) throw new Error(`AI_REWRITE_FORBIDDEN_PATH:${change.path}`);
    if (!setStringPath(draft, change.path, change.value)) throw new Error(`AI_REWRITE_INVALID_PATH:${change.path}`);
  }
  const parsed = pageBlockSchema.safeParse(draft);
  if (!parsed.success) throw new Error(`AI_REWRITE_INVALID_BLOCK:${parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`).join(";")}`);
  if (parsed.data.id !== block.id || parsed.data.type !== block.type) throw new Error("AI_REWRITE_CHANGED_BLOCK_IDENTITY");
  return parsed.data;
}

export function applyCopyVariant(document: PageDocument, variants: CopyVariantsSuggestion, index: number): PageDocument {
  const variant = variants.variants[index];
  if (!variant) throw new Error("AI_VARIANT_NOT_FOUND");
  let updatedHero = false;
  const blocks = document.blocks.map((block): PageBlock => {
    if (block.type === "hero" && !updatedHero) {
      updatedHero = true;
      return { ...block, headline: variant.headline, subheadline: variant.subheadline };
    }
    if (block.type === "cta") return { ...block, ctaLabel: variant.ctaLabel };
    if (block.type === "form") return { ...block, ctaLabel: variant.ctaLabel };
    if (block.type === "stickyCta") return { ...block, label: variant.ctaLabel };
    return block;
  });
  return pageDocumentSchema.parse({ ...document, blocks });
}

export function applyFaqSuggestion(document: PageDocument, suggestion: FaqSuggestion): PageDocument {
  const replacement: PageBlock = {
    id: newId(), version: 1, type: "faq", visible: true, title: suggestion.title,
    items: suggestion.items.map((item) => ({ id: newId(), question: item.question, answer: item.answer }))
  };
  let replaced = false;
  const blocks = document.blocks.map((block) => {
    if (block.type !== "faq" || replaced) return block;
    replaced = true;
    return { ...replacement, id: block.id };
  });
  if (!replaced) {
    const footerIndex = blocks.findIndex((block) => block.type === "footer");
    if (footerIndex >= 0) blocks.splice(footerIndex, 0, replacement);
    else blocks.push(replacement);
  }
  return pageDocumentSchema.parse({ ...document, blocks });
}

export function applySeoSuggestion(current: PageSeo, suggestion: SeoSuggestion): PageSeo {
  return pageSeoSchema.parse({
    ...current,
    title: suggestion.title,
    description: suggestion.description,
    socialTitle: suggestion.socialTitle,
    socialDescription: suggestion.socialDescription
  });
}
