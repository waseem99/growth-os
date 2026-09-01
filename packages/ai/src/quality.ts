import { collectAssetIds, pageDocumentSchema, pageSeoSchema, type PageDocument } from "@growth-os/page-engine";
import { qualityReportSchema, type QualityReport } from "./contracts";

export type QualityAsset = { id: string; title?: string | null; altText?: string | null };
type Finding = QualityReport["findings"][number];

const push = (findings: Finding[], finding: Finding) => findings.push(finding);

function visibleStrings(document: PageDocument) {
  const values: Array<{ path: string; value: string }> = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) values.push({ path, value: trimmed });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}.${index}`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (["id", "type", "version", "href"].includes(key) || key.endsWith("AssetId") || key === "assetId") continue;
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  };
  document.blocks.forEach((block, index) => { if (block.visible) walk(block, `blocks.${index}`); });
  return values;
}

export function inspectPageQuality(input: { document: unknown; seo: unknown; assets?: readonly QualityAsset[] }): QualityReport {
  const findings: Finding[] = [];
  const parsedPage = pageDocumentSchema.safeParse(input.document);
  const parsedSeo = pageSeoSchema.safeParse(input.seo);
  if (!parsedPage.success) {
    for (const issue of parsedPage.error.issues.slice(0, 30)) push(findings, { severity: "error", code: "INVALID_PAGE_SCHEMA", path: `content.${issue.path.join(".")}`, message: issue.message, suggestion: "Fix this field in the normal page editor before publishing." });
  }
  if (!parsedSeo.success) {
    for (const issue of parsedSeo.error.issues.slice(0, 20)) push(findings, { severity: "error", code: "INVALID_SEO_SCHEMA", path: `seo.${issue.path.join(".")}`, message: issue.message, suggestion: "Complete the SEO field with a valid value." });
  }
  if (!parsedPage.success || !parsedSeo.success) return qualityReportSchema.parse({ score: Math.max(0, 100 - findings.length * 20), findings });

  const document = parsedPage.data;
  const seo = parsedSeo.data;
  const visible = document.blocks.filter((block) => block.visible);
  const heroes = visible.filter((block) => block.type === "hero");
  const conversionBlocks = visible.filter((block) => block.type === "cta" || block.type === "form" || block.type === "pricing" || block.type === "stickyCta");
  if (heroes.length === 0) push(findings, { severity: "error", code: "MISSING_HERO", path: "content.blocks", message: "The page has no visible hero block.", suggestion: "Add one clear hero with the campaign promise and primary value proposition." });
  if (heroes.length > 1) push(findings, { severity: "warning", code: "MULTIPLE_HEROES", path: "content.blocks", message: "The page has multiple visible hero blocks.", suggestion: "Use one primary hero so the page has a clear first message." });
  const hero = heroes[0];
  if (hero?.type === "hero") {
    if (hero.headline.trim().length < 18) push(findings, { severity: "warning", code: "WEAK_HERO_HEADLINE", path: "hero.headline", message: "The hero headline is very short and may not communicate the offer clearly.", suggestion: "State the main product or offer benefit more explicitly." });
    if (hero.subheadline.trim().length < 24) push(findings, { severity: "suggestion", code: "THIN_HERO_SUPPORT", path: "hero.subheadline", message: "The hero supporting copy is sparse.", suggestion: "Add one concise sentence explaining why the visitor should act now." });
  }
  if (conversionBlocks.length === 0) push(findings, { severity: "error", code: "MISSING_PRIMARY_CTA", path: "content.blocks", message: "There is no visible conversion/CTA block.", suggestion: "Add a CTA, form, pricing or sticky CTA tied to the page conversion goal." });

  for (const [index, block] of document.blocks.entries()) {
    if (!block.visible) continue;
    const labels: Array<{ path: string; value: string }> = [];
    if (block.type === "cta") labels.push({ path: `blocks.${index}.ctaLabel`, value: block.ctaLabel });
    if (block.type === "form") labels.push({ path: `blocks.${index}.ctaLabel`, value: block.ctaLabel });
    if (block.type === "pricing") labels.push({ path: `blocks.${index}.ctaLabel`, value: block.ctaLabel });
    if (block.type === "stickyCta") labels.push({ path: `blocks.${index}.label`, value: block.label });
    for (const label of labels) {
      if (/^(click|submit|continue|go|here)$/i.test(label.value.trim())) push(findings, { severity: "warning", code: "GENERIC_CTA", path: label.path, message: `CTA "${label.value}" is generic.`, suggestion: "Use a specific action label such as Start learning, Subscribe now or Get the offer." });
    }
    if (block.type === "form" && block.variant === "subscription") {
      if (block.consentLabel.trim().length < 20) push(findings, { severity: "warning", code: "THIN_SUBSCRIPTION_CONSENT", path: `blocks.${index}.consentLabel`, message: "Subscription consent copy is very short.", suggestion: "Make recurring billing/terms consent explicit and link legal terms in the surrounding page flow." });
      if (block.disclosure.trim().length < 25) push(findings, { severity: "warning", code: "THIN_SUBSCRIPTION_DISCLOSURE", path: `blocks.${index}.disclosure`, message: "Subscription disclosure is too sparse.", suggestion: "Clearly state initial charge, renewal cadence and recurring amount from the configured offer." });
    }
  }

  if (seo.title.length < 30) push(findings, { severity: "suggestion", code: "SHORT_SEO_TITLE", path: "seo.title", message: "SEO title is short.", suggestion: "Use the available title space to communicate the product and strongest value proposition." });
  if (seo.description.length < 90) push(findings, { severity: "suggestion", code: "SHORT_META_DESCRIPTION", path: "seo.description", message: "Meta description is brief.", suggestion: "Add a concise benefit and action context while remaining within the configured limit." });
  if (!seo.socialTitle.trim() || !seo.socialDescription.trim()) push(findings, { severity: "suggestion", code: "SOCIAL_METADATA_INCOMPLETE", path: "seo", message: "Social title or description is empty.", suggestion: "Add campaign-specific social metadata for shared links." });

  const assetMap = new Map((input.assets ?? []).map((asset) => [asset.id, asset]));
  for (const assetId of collectAssetIds(document)) {
    const asset = assetMap.get(assetId);
    if (!asset) {
      push(findings, { severity: "warning", code: "ASSET_METADATA_UNAVAILABLE", path: `assets.${assetId}`, message: "Referenced asset metadata was not available to the quality check.", suggestion: "Verify the asset exists in the same brand and has useful metadata." });
    } else if (!asset.altText?.trim()) {
      push(findings, { severity: "warning", code: "MISSING_ASSET_ALT", path: `assets.${assetId}.altText`, message: `Asset ${asset.title || assetId} has no alt text.`, suggestion: "Add concise contextual alt text, or mark decorative media appropriately in a future component-specific accessibility setting." });
    }
  }

  const strings = visibleStrings(document).filter(({ value }) => value.length >= 30);
  const seen = new Map<string, string>();
  for (const entry of strings) {
    const normalized = entry.value.toLowerCase().replace(/\s+/g, " ");
    const first = seen.get(normalized);
    if (first) {
      push(findings, { severity: "suggestion", code: "DUPLICATE_COPY", path: entry.path, message: "This longer copy appears elsewhere on the page.", suggestion: `Differentiate this message from ${first} so each section advances the visitor.` });
      break;
    }
    seen.set(normalized, entry.path);
  }
  if (!visible.some((block) => block.type === "faq")) push(findings, { severity: "suggestion", code: "NO_FAQ", path: "content.blocks", message: "The page has no FAQ block.", suggestion: "For higher-consideration offers, add concise answers to pricing, renewal, eligibility and support questions." });

  const penalty = findings.reduce((sum, finding) => sum + (finding.severity === "error" ? 20 : finding.severity === "warning" ? 8 : 2), 0);
  return qualityReportSchema.parse({ score: Math.max(0, 100 - penalty), findings });
}
