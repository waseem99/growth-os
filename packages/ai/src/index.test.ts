import { describe, expect, it } from "vitest";
import { pageDocumentSchema, pageSeoSchema, skillupCleanReference } from "@growth-os/page-engine";
import {
  MockAiProvider,
  applyBlockRewrite,
  applyCopyVariant,
  composeGeneratedPage,
  copyVariantsSuggestionSchema,
  generateValidated,
  generatedPageCopySchema,
  inspectPageQuality
} from "./index";

const validCopy = {
  pageName: "SkillUp AI Skills",
  hero: {
    eyebrow: "Learn smarter",
    headline: "Build practical AI skills through games",
    highlightedText: "AI skills",
    subheadline: "Practice useful AI concepts in short, mobile-first challenges built for everyday learners.",
    promoHeadline: "",
    promoSubheadline: ""
  },
  benefits: [
    { title: "Practice", text: "Learn by doing in short challenges." },
    { title: "Build skills", text: "Focus on useful, practical concepts." },
    { title: "Learn anywhere", text: "Use a mobile-first learning flow." }
  ],
  showcase: {
    title: "What you can learn",
    intro: "Explore practical skill areas.",
    items: [
      { title: "AI basics", text: "Understand useful AI concepts." },
      { title: "Work skills", text: "Apply tools to everyday work." }
    ]
  },
  cta: { title: "Start learning", body: "Choose the configured offer and begin.", label: "Start learning" },
  faq: [
    { question: "What is SkillUp?", answer: "SkillUp is the learning product described in this campaign." },
    { question: "How do I start?", answer: "Use the page action and follow the configured subscription flow." },
    { question: "Where are billing terms?", answer: "Check the pricing disclosure and configured terms on the page." }
  ],
  seo: {
    title: "Learn Practical AI Skills Through Games | SkillUp",
    description: "Build practical AI skills through short game-based lessons and a mobile-first learning experience designed for everyday learners.",
    socialTitle: "Learn practical AI skills with SkillUp",
    socialDescription: "Practice useful AI concepts through a game-first, mobile learning experience."
  }
};

const brief = {
  brandName: "SkillUp",
  productName: "SkillUp",
  platform: "TikTok",
  audience: "Young adults in Pakistan interested in practical digital skills",
  offer: "Configured SkillUp subscription offer; do not invent prices",
  conversionGoal: "subscription_started",
  tone: "clear, energetic and credible",
  positioning: "learn practical AI skills through games",
  templateKey: "subscription-acquisition" as const,
  stylePreset: "clean-light" as const,
  locale: "en-PK"
};

describe("GrowthOS AI", () => {
  it("repairs one invalid structured provider response and validates the second", async () => {
    let calls = 0;
    const provider = new MockAiProvider(() => {
      calls += 1;
      return calls === 1 ? { pageName: "broken" } : validCopy;
    });
    const result = await generateValidated(provider, {
      action: "generate_page",
      system: "test",
      user: "test",
      schemaName: "generated_page_copy",
      schema: generatedPageCopySchema
    });
    expect(calls).toBe(2);
    expect(result.data.hero.headline).toContain("AI skills");
  });

  it("composes AI copy through the existing page and SEO schemas", () => {
    const result = composeGeneratedPage(brief, generatedPageCopySchema.parse(validCopy));
    expect(pageDocumentSchema.safeParse(result.document).success).toBe(true);
    expect(pageSeoSchema.safeParse(result.seo).success).toBe(true);
    expect(result.document.templateKey).toBe("subscription-acquisition");
    expect(result.document.blocks.some((block) => block.type === "faq")).toBe(true);
  });

  it("allows copy rewrite but rejects configuration/link mutation", () => {
    const document = pageDocumentSchema.parse(skillupCleanReference);
    const hero = document.blocks.find((block) => block.type === "hero");
    expect(hero?.type).toBe("hero");
    if (!hero || hero.type !== "hero") throw new Error("missing hero");
    const changed = applyBlockRewrite(hero, { summary: "Stronger benefit", changes: [{ path: "headline", value: "Build practical AI skills faster" }] });
    expect(changed.type === "hero" && changed.headline).toContain("AI skills");
    expect(() => applyBlockRewrite(hero, { summary: "unsafe", changes: [{ path: "variant", value: "promotional" }] })).toThrow(/FORBIDDEN_PATH/);
  });

  it("applies a selected copy variant without changing page identity/config", () => {
    const document = pageDocumentSchema.parse(skillupCleanReference);
    const variants = copyVariantsSuggestionSchema.parse({ variants: [
      { name: "Career", angle: "career", headline: "Build AI skills for practical work", subheadline: "Learn useful concepts through short game-based lessons.", ctaLabel: "Start learning" },
      { name: "Mobile", angle: "convenience", headline: "Learn practical AI skills from anywhere", subheadline: "Use a mobile-first game format designed for short learning sessions.", ctaLabel: "Learn now" }
    ] });
    const result = applyCopyVariant(document, variants, 1);
    expect(result.templateKey).toBe(document.templateKey);
    expect(result.blocks.map((block) => block.id)).toEqual(document.blocks.map((block) => block.id));
  });

  it("returns deterministic quality findings without any external provider", () => {
    const document = pageDocumentSchema.parse(skillupCleanReference);
    const seo = pageSeoSchema.parse({
      title: "SkillUp AI Learning Campaign",
      description: "Learn practical AI skills through games with a mobile-first SkillUp learning experience designed for everyday learners.",
      index: true,
      canonicalUrl: null,
      socialAssetId: null,
      socialTitle: "",
      socialDescription: "",
      structuredData: {}
    });
    const result = inspectPageQuality({ document, seo });
    expect(result.score).toBeLessThan(100);
    expect(result.findings.some((finding) => finding.code === "SOCIAL_METADATA_INCOMPLETE")).toBe(true);
  });
});
