import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 1, prepare: false });

const ids = {
  user: "00000000-0000-4000-8000-000000000001",
  skillupBrand: "00000000-0000-4000-8000-000000000010", skillupDomain: "00000000-0000-4000-8000-000000000011",
  skillupOffer: "00000000-0000-4000-8000-000000000020", skillupOfferVersion: "00000000-0000-4000-8000-000000000021",
  skillupCampaign: "00000000-0000-4000-8000-000000000030", skillupTemplate: "00000000-0000-4000-8000-000000000040",
  skillupPage: "00000000-0000-4000-8000-000000000050", skillupPageVersion: "00000000-0000-4000-8000-000000000051", skillupPageVersionB: "00000000-0000-4000-8000-000000000052",
  skillupExperiment: "00000000-0000-4000-8000-000000000900", skillupVariantControl: "00000000-0000-4000-8000-000000000901", skillupVariantB: "00000000-0000-4000-8000-000000000902",
  jalwaBrand: "00000000-0000-4000-8000-000000000110", jalwaDomain: "00000000-0000-4000-8000-000000000111",
  jalwaTemplate: "00000000-0000-4000-8000-000000000140", jalwaPage: "00000000-0000-4000-8000-000000000150", jalwaPageVersion: "00000000-0000-4000-8000-000000000151"
} as const;

const skillupSeo = {
  title: "Learn AI Skills Through Games | SkillUp",
  description: "Build practical AI skills with short, game-based learning experiences designed for fast, focused progress on SkillUp.",
  index: true,
  canonicalUrl: null,
  socialAssetId: null,
  socialTitle: "Learn AI skills through games",
  socialDescription: "A fast, interactive SkillUp learning experience for practical AI skills.",
  structuredData: {}
};
const skillupSeoB = { ...skillupSeo, title: "Build Practical AI Skills Faster | SkillUp", socialTitle: "Build practical AI skills faster" };
const jalwaSeo = {
  title: "Jalwa Entertainment | Watch What You Love",
  description: "Discover Jalwa entertainment and continue to the latest subscription experience from one fast, mobile-first campaign page.",
  index: true,
  canonicalUrl: null,
  socialAssetId: null,
  socialTitle: "Jalwa entertainment worth watching",
  socialDescription: "Discover the latest Jalwa entertainment experience.",
  structuredData: {}
};

const skillupDocument = {
  schemaVersion: 1,
  templateKey: "subscription-acquisition",
  stylePreset: "clean-light",
  blocks: [
    { id: "00000000-0000-4000-8000-000000000060", version: 1, visible: true, type: "hero", variant: "clean", eyebrow: "Learn smarter", headline: "Learn AI skills through games", highlightedText: "AI skills", subheadline: "Short interactive challenges help you learn practical AI concepts without long lectures.", heroAssetId: null, backgroundAssetId: null, partnerLogoAssetId: null, promoHeadline: "", promoSubheadline: "" },
    { id: "00000000-0000-4000-8000-000000000061", version: 1, visible: true, type: "benefits", variant: "cards", items: [
      { id: "00000000-0000-4000-8000-000000000062", title: "Learn by doing", text: "Practice concepts through interactive challenges.", iconAssetId: null },
      { id: "00000000-0000-4000-8000-000000000063", title: "Move at your pace", text: "Build useful skills in short focused sessions.", iconAssetId: null }
    ] },
    { id: "00000000-0000-4000-8000-000000000064", version: 1, visible: true, type: "pricing", title: "Start for PKR 1", body: "Continue with SkillUp Premium after the trial based on the offer shown at checkout.", ctaLabel: "Start learning" },
    { id: "00000000-0000-4000-8000-000000000065", version: 1, visible: true, type: "form", variant: "subscription", title: "Start your SkillUp subscription", provider: "generic", inputLabel: "Mobile number", placeholder: "03XX XXXXXXX", consentLabel: "I agree to the displayed subscription terms.", ctaLabel: "Continue", disclosure: "Review the current price and renewal terms before confirming your subscription." },
    { id: "00000000-0000-4000-8000-000000000066", version: 1, visible: true, type: "footer", secureText: "Secure subscription flow", privacyText: "Privacy respected", supportText: "Support available", legalText: "Terms and pricing shown at checkout apply." }
  ]
};
const skillupDocumentB = {
  ...skillupDocument,
  stylePreset: "premium-purple",
  blocks: skillupDocument.blocks.map((block) => block.type === "hero" ? { ...block, headline: "Build practical AI skills faster", highlightedText: "faster", subheadline: "Turn AI concepts into usable skills through focused game-based practice." } : block)
};
const jalwaDocument = {
  schemaVersion: 1,
  templateKey: "content-acquisition",
  stylePreset: "campaign-dark",
  blocks: [
    { id: "00000000-0000-4000-8000-000000000160", version: 1, visible: true, type: "hero", variant: "promotional", eyebrow: "Jalwa", headline: "Entertainment worth watching", highlightedText: "watching", subheadline: "Discover the latest Jalwa content and continue to the current subscription offer.", heroAssetId: null, backgroundAssetId: null, partnerLogoAssetId: null, promoHeadline: "", promoSubheadline: "" },
    { id: "00000000-0000-4000-8000-000000000161", version: 1, visible: true, type: "cta", title: "Ready to watch?", body: "Continue to the current Jalwa subscription experience.", ctaLabel: "Watch now", href: "#checkout" },
    { id: "00000000-0000-4000-8000-000000000162", version: 1, visible: true, type: "footer", secureText: "Secure experience", privacyText: "Privacy respected", supportText: "Support available", legalText: "Current subscription terms apply." }
  ]
};

try {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO app_users (id, email, name, role) VALUES (${ids.user}, 'admin@growthos.local', 'GrowthOS Demo Admin', 'owner') ON CONFLICT (email) DO NOTHING`;
    await tx`INSERT INTO brands (id, name, slug, status, theme, defaults, created_by, updated_by) VALUES (${ids.skillupBrand}, 'SkillUp', 'skillup', 'active', ${tx.json({ primary: "#6030ff", secondary: "#11072c", background: "#ffffff", text: "#15111f", fontFamily: "Inter, system-ui, sans-serif", radius: "16px" })}, ${tx.json({ locale: "en-PK", defaultCtaLabel: "Pay Now", defaultConversionGoal: "subscription_started", defaultSeoTitle: "Learn AI skills through games" })}, ${ids.user}, ${ids.user}) ON CONFLICT (slug) DO UPDATE SET theme=EXCLUDED.theme, defaults=EXCLUDED.defaults`;
    await tx`INSERT INTO domains (id, brand_id, hostname, status, is_primary) VALUES (${ids.skillupDomain}, ${ids.skillupBrand}, 'skillup.localhost', 'verified', true) ON CONFLICT (hostname) DO UPDATE SET status='verified', is_primary=true`;
    await tx`INSERT INTO offers (id, brand_id, name, slug) VALUES (${ids.skillupOffer}, ${ids.skillupBrand}, 'SkillUp Premium', 'premium') ON CONFLICT (brand_id, slug) DO NOTHING`;
    await tx`INSERT INTO offer_versions (id, offer_id, version_number, currency, initial_amount, recurring_amount, billing_interval, trial_days, auto_renew, benefit, terms, created_by) VALUES (${ids.skillupOfferVersion}, ${ids.skillupOffer}, 1, 'PKR', 1, 599, 'month', 1, true, ${tx.json({ kind: "subscription" })}, ${tx.json({ disclosure: "PKR 1 initial charge, then PKR 599/month after the trial." })}, ${ids.user}) ON CONFLICT (offer_id, version_number) DO NOTHING`;
    await tx`INSERT INTO campaigns (id, brand_id, offer_version_id, name, platform, objective, status, utm_defaults, created_by, updated_by) VALUES (${ids.skillupCampaign}, ${ids.skillupBrand}, ${ids.skillupOfferVersion}, 'SkillUp Demo Acquisition', 'tiktok', 'subscription', 'draft', ${tx.json({ source: "tiktok", medium: "paid_social", campaign: "skillup_demo", creativeId: "seed-video-01" })}, ${ids.user}, ${ids.user}) ON CONFLICT (id) DO NOTHING`;
    await tx`INSERT INTO templates (id, brand_id, name, slug, schema_version, content) VALUES (${ids.skillupTemplate}, ${ids.skillupBrand}, 'Subscription Acquisition', 'subscription-acquisition', 1, ${tx.json(skillupDocument)}) ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content`;
    await tx`INSERT INTO landing_pages (id, brand_id, domain_id, campaign_id, template_id, name, slug, conversion_goal, draft_content, draft_seo, created_by, updated_by) VALUES (${ids.skillupPage}, ${ids.skillupBrand}, ${ids.skillupDomain}, ${ids.skillupCampaign}, ${ids.skillupTemplate}, 'SkillUp AI Games', 'ai-games', 'subscription_started', ${tx.json(skillupDocument)}, ${tx.json(skillupSeo)}, ${ids.user}, ${ids.user}) ON CONFLICT (id) DO UPDATE SET draft_content=EXCLUDED.draft_content, draft_seo=EXCLUDED.draft_seo`;
    await tx`INSERT INTO page_versions (id, page_id, offer_version_id, version_number, schema_version, content, seo, publish_note, created_by) VALUES (${ids.skillupPageVersion}, ${ids.skillupPage}, ${ids.skillupOfferVersion}, 1, 1, ${tx.json(skillupDocument)}, ${tx.json(skillupSeo)}, 'Seed control version', ${ids.user}) ON CONFLICT (page_id, version_number) DO UPDATE SET content=EXCLUDED.content, seo=EXCLUDED.seo`;
    await tx`INSERT INTO page_versions (id, page_id, offer_version_id, version_number, schema_version, content, seo, publish_note, created_by) VALUES (${ids.skillupPageVersionB}, ${ids.skillupPage}, ${ids.skillupOfferVersion}, 2, 1, ${tx.json(skillupDocumentB)}, ${tx.json(skillupSeoB)}, 'Seed experiment variant', ${ids.user}) ON CONFLICT (page_id, version_number) DO UPDATE SET content=EXCLUDED.content, seo=EXCLUDED.seo`;
    await tx`INSERT INTO page_publications (page_id, version_id, published_by) VALUES (${ids.skillupPage}, ${ids.skillupPageVersion}, ${ids.user}) ON CONFLICT (page_id) DO UPDATE SET version_id=EXCLUDED.version_id, published_at=now(), published_by=EXCLUDED.published_by`;

    await tx`INSERT INTO experiments (id, page_id, campaign_id, name, status, starts_at) VALUES (${ids.skillupExperiment}, ${ids.skillupPage}, ${ids.skillupCampaign}, 'SkillUp Seed Experiment', 'paused', now() - interval '1 day') ON CONFLICT (id) DO UPDATE SET status='paused'`;
    await tx`INSERT INTO variants (id, experiment_id, page_version_id, name, allocation, is_control) VALUES (${ids.skillupVariantControl}, ${ids.skillupExperiment}, ${ids.skillupPageVersion}, 'Control', 50, true) ON CONFLICT (id) DO UPDATE SET allocation=50, is_control=true`;
    await tx`INSERT INTO variants (id, experiment_id, page_version_id, name, allocation, is_control) VALUES (${ids.skillupVariantB}, ${ids.skillupExperiment}, ${ids.skillupPageVersionB}, 'Faster skills angle', 50, false) ON CONFLICT (id) DO UPDATE SET allocation=50, is_control=false`;

    await tx`INSERT INTO brands (id, name, slug, status, theme, defaults, created_by, updated_by) VALUES (${ids.jalwaBrand}, 'Jalwa', 'jalwa', 'active', ${tx.json({ primary: "#ff3d71", secondary: "#151022", background: "#0d0a12", text: "#ffffff", fontFamily: "Inter, system-ui, sans-serif", radius: "18px" })}, ${tx.json({ locale: "en-PK", defaultCtaLabel: "Watch now", defaultConversionGoal: "subscription_started", defaultSeoTitle: "Jalwa — entertainment worth watching" })}, ${ids.user}, ${ids.user}) ON CONFLICT (slug) DO UPDATE SET theme=EXCLUDED.theme, defaults=EXCLUDED.defaults`;
    await tx`INSERT INTO domains (id, brand_id, hostname, status, is_primary) VALUES (${ids.jalwaDomain}, ${ids.jalwaBrand}, 'jalwa.localhost', 'verified', true) ON CONFLICT (hostname) DO UPDATE SET status='verified', is_primary=true`;
    await tx`INSERT INTO templates (id, brand_id, name, slug, schema_version, content) VALUES (${ids.jalwaTemplate}, ${ids.jalwaBrand}, 'Content Acquisition', 'content-acquisition', 1, ${tx.json(jalwaDocument)}) ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content`;
    await tx`INSERT INTO landing_pages (id, brand_id, domain_id, template_id, name, slug, conversion_goal, draft_content, draft_seo, created_by, updated_by) VALUES (${ids.jalwaPage}, ${ids.jalwaBrand}, ${ids.jalwaDomain}, ${ids.jalwaTemplate}, 'Jalwa Watch', 'watch', 'subscription_started', ${tx.json(jalwaDocument)}, ${tx.json(jalwaSeo)}, ${ids.user}, ${ids.user}) ON CONFLICT (id) DO UPDATE SET draft_content=EXCLUDED.draft_content, draft_seo=EXCLUDED.draft_seo`;
    await tx`INSERT INTO page_versions (id, page_id, version_number, schema_version, content, seo, publish_note, created_by) VALUES (${ids.jalwaPageVersion}, ${ids.jalwaPage}, 1, 1, ${tx.json(jalwaDocument)}, ${tx.json(jalwaSeo)}, 'Seed version', ${ids.user}) ON CONFLICT (page_id, version_number) DO UPDATE SET content=EXCLUDED.content, seo=EXCLUDED.seo`;
    await tx`INSERT INTO page_publications (page_id, version_id, published_by) VALUES (${ids.jalwaPage}, ${ids.jalwaPageVersion}, ${ids.user}) ON CONFLICT (page_id) DO UPDATE SET version_id=EXCLUDED.version_id, published_at=now(), published_by=EXCLUDED.published_by`;

    const attribution = tx.json({
      firstTouch: { source: "tiktok", medium: "paid_social", campaign: "skillup_demo", term: null, content: "seed-video", creativeId: "seed-video-01", capturedAt: new Date().toISOString() },
      lastTouch: { source: "tiktok", medium: "paid_social", campaign: "skillup_demo", term: null, content: "seed-video", creativeId: "seed-video-01", capturedAt: new Date().toISOString() }
    });
    const productionProps = tx.json({ seeded: true, experimentId: ids.skillupExperiment, testTraffic: false });
    await tx`INSERT INTO analytics_events (event_id, event_name, occurred_at, brand_id, campaign_id, page_id, version_id, variant_id, creative_id, session_id, anonymous_id, source, medium, campaign_name, content, properties)
      VALUES ('seed-event-landing-0001', 'landing_view', now() - interval '10 minutes', ${ids.skillupBrand}, ${ids.skillupCampaign}, ${ids.skillupPage}, ${ids.skillupPageVersion}, ${ids.skillupVariantControl}, 'seed-video-01', 'seed-session-0001', 'seed-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${productionProps}),
             ('seed-event-cta-0000001', 'cta_click', now() - interval '8 minutes', ${ids.skillupBrand}, ${ids.skillupCampaign}, ${ids.skillupPage}, ${ids.skillupPageVersion}, ${ids.skillupVariantControl}, 'seed-video-01', 'seed-session-0001', 'seed-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${productionProps}),
             ('seed-event-signup-0001', 'signup_start', now() - interval '7 minutes', ${ids.skillupBrand}, ${ids.skillupCampaign}, ${ids.skillupPage}, ${ids.skillupPageVersion}, ${ids.skillupVariantControl}, 'seed-video-01', 'seed-session-0001', 'seed-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${productionProps}),
             ('seed-event-checkout-001', 'checkout_start', now() - interval '5 minutes', ${ids.skillupBrand}, ${ids.skillupCampaign}, ${ids.skillupPage}, ${ids.skillupPageVersion}, ${ids.skillupVariantControl}, 'seed-video-01', 'seed-session-0001', 'seed-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${productionProps}),
             ('seed-event-test-variant-b', 'landing_view', now() - interval '4 minutes', ${ids.skillupBrand}, ${ids.skillupCampaign}, ${ids.skillupPage}, ${ids.skillupPageVersionB}, ${ids.skillupVariantB}, 'seed-video-01', 'seed-test-session-0001', 'seed-test-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${tx.json({ seeded: true, experimentId: ids.skillupExperiment, testTraffic: true })})
      ON CONFLICT (event_id) DO NOTHING`;
    await tx`INSERT INTO conversions (idempotency_key, event_name, occurred_at, brand_id, campaign_id, page_id, variant_id, session_id, value, currency, attribution, properties)
      VALUES ('seed-conversion-subscription-0001', 'subscription_started', now() - interval '3 minutes', ${ids.skillupBrand}, ${ids.skillupCampaign}, ${ids.skillupPage}, ${ids.skillupVariantControl}, 'seed-session-0001', 599, 'PKR', ${attribution}, ${tx.json({ seeded: true, experimentId: ids.skillupExperiment, testTraffic: false, versionId: ids.skillupPageVersion })})
      ON CONFLICT (idempotency_key) DO NOTHING`;
  });
  console.log("Seeded valid SkillUp/Jalwa pages, one experiment and a reconciled acquisition flow");
} finally { await sql.end(); }
