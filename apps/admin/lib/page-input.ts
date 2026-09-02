import {
  pageDocumentSchema,
  skillupCleanReference,
  contentAcquisitionTemplate,
  gameAcquisitionTemplate,
  type PageDocument,
  type PageDocumentInput
} from "@growth-os/page-engine";

const minimalInput: PageDocumentInput = {
  schemaVersion: 1,
  templateKey: "minimal",
  stylePreset: "minimal",
  blocks: [
    { id: "00000000-0000-4000-8000-000000009001", type: "header", visible: true, badge: "", trustText: "", logoAssetId: null },
    { id: "00000000-0000-4000-8000-000000009002", type: "hero", visible: true, variant: "minimal", eyebrow: "", headline: "Campaign headline", highlightedText: "", subheadline: "Campaign supporting copy", heroAssetId: null, backgroundAssetId: null, partnerLogoAssetId: null, promoHeadline: "", promoSubheadline: "" },
    { id: "00000000-0000-4000-8000-000000009003", type: "cta", visible: true, title: "Ready to continue?", body: "", ctaLabel: "Continue", href: "#" },
    { id: "00000000-0000-4000-8000-000000009004", type: "footer", visible: true, secureText: "", privacyText: "Privacy protected", supportText: "Support available", legalText: "" }
  ]
};

export const PAGE_TEMPLATE_OPTIONS = [
  { key: "subscription-acquisition", label: "Subscription Acquisition" },
  { key: "content-acquisition", label: "Content Acquisition" },
  { key: "game-acquisition", label: "Game Acquisition" },
  { key: "minimal", label: "Minimal" }
] as const;

function sourceForTemplate(key: string): PageDocumentInput {
  if (key === "subscription-acquisition") return skillupCleanReference;
  if (key === "content-acquisition") return contentAcquisitionTemplate;
  if (key === "game-acquisition") return gameAcquisitionTemplate;
  return minimalInput;
}

function reseed(value: unknown, key?: string): unknown {
  if (key === "id" && typeof value === "string") return crypto.randomUUID();
  if (Array.isArray(value)) return value.map((entry) => reseed(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, reseed(childValue, childKey)]));
  }
  return value;
}

export function instantiatePageTemplate(key: string): PageDocument {
  const parsed = pageDocumentSchema.parse(sourceForTemplate(key));
  return pageDocumentSchema.parse(reseed(parsed));
}

export function reseedPageDocument(document: PageDocument): PageDocument {
  return pageDocumentSchema.parse(reseed(document));
}

export function applyAdCreative(document: PageDocument, creative: { assetId: string; headline?: string | null; primaryText?: string | null; cta?: string | null }): PageDocument {
  const raw = structuredClone(document) as unknown as { blocks?: Array<Record<string, unknown>> };
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const hero = blocks.find((block) => block.type === "hero");
  if (hero) {
    if (creative.headline) hero.headline = creative.headline;
    if (creative.primaryText) hero.subheadline = creative.primaryText;
    hero.heroAssetId = creative.assetId;
  }
  const cta = blocks.find((block) => block.type === "cta");
  if (cta && creative.cta) cta.ctaLabel = creative.cta;
  const subscriptionForm = blocks.find((block) => block.type === "form" && block.variant === "subscription");
  if (subscriptionForm && creative.cta) subscriptionForm.ctaLabel = creative.cta;
  return pageDocumentSchema.parse(raw);
}

export function normalizePageSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
