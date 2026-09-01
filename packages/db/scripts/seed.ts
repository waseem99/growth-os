import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 1, prepare: false });

const ids = {
  user: "00000000-0000-4000-8000-000000000001",
  skillupBrand: "00000000-0000-4000-8000-000000000010", skillupDomain: "00000000-0000-4000-8000-000000000011",
  skillupOffer: "00000000-0000-4000-8000-000000000020", skillupOfferVersion: "00000000-0000-4000-8000-000000000021",
  skillupCampaign: "00000000-0000-4000-8000-000000000030", skillupTemplate: "00000000-0000-4000-8000-000000000040",
  skillupPage: "00000000-0000-4000-8000-000000000050", skillupPageVersion: "00000000-0000-4000-8000-000000000051",
  jalwaBrand: "00000000-0000-4000-8000-000000000110", jalwaDomain: "00000000-0000-4000-8000-000000000111",
  jalwaTemplate: "00000000-0000-4000-8000-000000000140", jalwaPage: "00000000-0000-4000-8000-000000000150", jalwaPageVersion: "00000000-0000-4000-8000-000000000151"
} as const;

try {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO app_users (id, email, name, role) VALUES (${ids.user}, 'admin@growthos.local', 'GrowthOS Demo Admin', 'owner') ON CONFLICT (email) DO NOTHING`;
    await tx`INSERT INTO brands (id, name, slug, status, theme, defaults, created_by, updated_by) VALUES (${ids.skillupBrand}, 'SkillUp', 'skillup', 'active', ${tx.json({ primary: "#6030ff", secondary: "#11072c", background: "#ffffff", text: "#15111f", fontFamily: "Inter, system-ui, sans-serif", radius: "16px" })}, ${tx.json({ locale: "en-PK", defaultCtaLabel: "Pay Now", defaultConversionGoal: "subscription_started", defaultSeoTitle: "Learn AI skills through games" })}, ${ids.user}, ${ids.user}) ON CONFLICT (slug) DO UPDATE SET theme=EXCLUDED.theme, defaults=EXCLUDED.defaults`;
    await tx`INSERT INTO domains (id, brand_id, hostname, status, is_primary) VALUES (${ids.skillupDomain}, ${ids.skillupBrand}, 'skillup.localhost', 'verified', true) ON CONFLICT (hostname) DO UPDATE SET status='verified', is_primary=true`;
    await tx`INSERT INTO offers (id, brand_id, name, slug) VALUES (${ids.skillupOffer}, ${ids.skillupBrand}, 'SkillUp Premium', 'premium') ON CONFLICT (brand_id, slug) DO NOTHING`;
    await tx`INSERT INTO offer_versions (id, offer_id, version_number, currency, initial_amount, recurring_amount, billing_interval, trial_days, auto_renew, benefit, terms, created_by) VALUES (${ids.skillupOfferVersion}, ${ids.skillupOffer}, 1, 'PKR', 1, 599, 'month', 1, true, ${tx.json({ kind: "subscription" })}, ${tx.json({ disclosure: "PKR 1 initial charge, then PKR 599/month after the trial." })}, ${ids.user}) ON CONFLICT (offer_id, version_number) DO NOTHING`;
    await tx`INSERT INTO campaigns (id, brand_id, offer_version_id, name, platform, objective, status, utm_defaults, created_by, updated_by) VALUES (${ids.skillupCampaign}, ${ids.skillupBrand}, ${ids.skillupOfferVersion}, 'SkillUp Demo Acquisition', 'tiktok', 'subscription', 'draft', ${tx.json({ source: "tiktok", medium: "paid_social", campaign: "skillup_demo", creativeId: "seed-video-01" })}, ${ids.user}, ${ids.user}) ON CONFLICT (id) DO NOTHING`;
    await tx`INSERT INTO templates (id, brand_id, name, slug, schema_version, content) VALUES (${ids.skillupTemplate}, ${ids.skillupBrand}, 'Subscription Acquisition', 'subscription-acquisition', 1, ${tx.json({ blocks: [] })}) ON CONFLICT (id) DO NOTHING`;
    await tx`INSERT INTO landing_pages (id, brand_id, domain_id, campaign_id, template_id, name, slug, conversion_goal, draft_content, created_by, updated_by) VALUES (${ids.skillupPage}, ${ids.skillupBrand}, ${ids.skillupDomain}, ${ids.skillupCampaign}, ${ids.skillupTemplate}, 'SkillUp AI Games', 'ai-games', 'subscription_started', ${tx.json({ blocks: [] })}, ${ids.user}, ${ids.user}) ON CONFLICT (id) DO NOTHING`;
    await tx`INSERT INTO page_versions (id, page_id, offer_version_id, version_number, schema_version, content, seo, publish_note, created_by) VALUES (${ids.skillupPageVersion}, ${ids.skillupPage}, ${ids.skillupOfferVersion}, 1, 1, ${tx.json({ blocks: [] })}, ${tx.json({ title: "Learn AI Skills through games" })}, 'Seed version', ${ids.user}) ON CONFLICT (page_id, version_number) DO NOTHING`;
    await tx`INSERT INTO page_publications (page_id, version_id, published_by) VALUES (${ids.skillupPage}, ${ids.skillupPageVersion}, ${ids.user}) ON CONFLICT (page_id) DO UPDATE SET version_id=EXCLUDED.version_id, published_at=now(), published_by=EXCLUDED.published_by`;

    await tx`INSERT INTO brands (id, name, slug, status, theme, defaults, created_by, updated_by) VALUES (${ids.jalwaBrand}, 'Jalwa', 'jalwa', 'active', ${tx.json({ primary: "#ff3d71", secondary: "#151022", background: "#0d0a12", text: "#ffffff", fontFamily: "Inter, system-ui, sans-serif", radius: "18px" })}, ${tx.json({ locale: "en-PK", defaultCtaLabel: "Watch now", defaultConversionGoal: "subscription_started", defaultSeoTitle: "Jalwa — entertainment worth watching" })}, ${ids.user}, ${ids.user}) ON CONFLICT (slug) DO UPDATE SET theme=EXCLUDED.theme, defaults=EXCLUDED.defaults`;
    await tx`INSERT INTO domains (id, brand_id, hostname, status, is_primary) VALUES (${ids.jalwaDomain}, ${ids.jalwaBrand}, 'jalwa.localhost', 'verified', true) ON CONFLICT (hostname) DO UPDATE SET status='verified', is_primary=true`;
    await tx`INSERT INTO templates (id, brand_id, name, slug, schema_version, content) VALUES (${ids.jalwaTemplate}, ${ids.jalwaBrand}, 'Content Acquisition', 'content-acquisition', 1, ${tx.json({ blocks: [] })}) ON CONFLICT (id) DO NOTHING`;
    await tx`INSERT INTO landing_pages (id, brand_id, domain_id, template_id, name, slug, conversion_goal, draft_content, created_by, updated_by) VALUES (${ids.jalwaPage}, ${ids.jalwaBrand}, ${ids.jalwaDomain}, ${ids.jalwaTemplate}, 'Jalwa Watch', 'watch', 'subscription_started', ${tx.json({ blocks: [] })}, ${ids.user}, ${ids.user}) ON CONFLICT (id) DO NOTHING`;
    await tx`INSERT INTO page_versions (id, page_id, version_number, schema_version, content, seo, publish_note, created_by) VALUES (${ids.jalwaPageVersion}, ${ids.jalwaPage}, 1, 1, ${tx.json({ blocks: [] })}, ${tx.json({ title: "Jalwa — Watch" })}, 'Seed version', ${ids.user}) ON CONFLICT (page_id, version_number) DO NOTHING`;
    await tx`INSERT INTO page_publications (page_id, version_id, published_by) VALUES (${ids.jalwaPage}, ${ids.jalwaPageVersion}, ${ids.user}) ON CONFLICT (page_id) DO UPDATE SET version_id=EXCLUDED.version_id, published_at=now(), published_by=EXCLUDED.published_by`;

    const attribution = tx.json({
      firstTouch: { source: "tiktok", medium: "paid_social", campaign: "skillup_demo", term: null, content: "seed-video", creativeId: "seed-video-01", capturedAt: new Date().toISOString() },
      lastTouch: { source: "tiktok", medium: "paid_social", campaign: "skillup_demo", term: null, content: "seed-video", creativeId: "seed-video-01", capturedAt: new Date().toISOString() }
    });
    const eventBase = [ids.skillupBrand, ids.skillupCampaign, ids.skillupPage, ids.skillupPageVersion] as const;
    await tx`INSERT INTO analytics_events (event_id, event_name, occurred_at, brand_id, campaign_id, page_id, version_id, creative_id, session_id, anonymous_id, source, medium, campaign_name, content, properties)
      VALUES ('seed-event-landing-0001', 'landing_view', now() - interval '10 minutes', ${eventBase[0]}, ${eventBase[1]}, ${eventBase[2]}, ${eventBase[3]}, 'seed-video-01', 'seed-session-0001', 'seed-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${tx.json({ seeded: true })}),
             ('seed-event-cta-0000001', 'cta_click', now() - interval '8 minutes', ${eventBase[0]}, ${eventBase[1]}, ${eventBase[2]}, ${eventBase[3]}, 'seed-video-01', 'seed-session-0001', 'seed-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${tx.json({ seeded: true })}),
             ('seed-event-signup-0001', 'signup_start', now() - interval '7 minutes', ${eventBase[0]}, ${eventBase[1]}, ${eventBase[2]}, ${eventBase[3]}, 'seed-video-01', 'seed-session-0001', 'seed-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${tx.json({ seeded: true })}),
             ('seed-event-checkout-001', 'checkout_start', now() - interval '5 minutes', ${eventBase[0]}, ${eventBase[1]}, ${eventBase[2]}, ${eventBase[3]}, 'seed-video-01', 'seed-session-0001', 'seed-anon-0001', 'tiktok', 'paid_social', 'skillup_demo', 'seed-video', ${tx.json({ seeded: true })})
      ON CONFLICT (event_id) DO NOTHING`;
    await tx`INSERT INTO conversions (idempotency_key, event_name, occurred_at, brand_id, campaign_id, page_id, session_id, value, currency, attribution, properties)
      VALUES ('seed-conversion-subscription-0001', 'subscription_started', now() - interval '3 minutes', ${ids.skillupBrand}, ${ids.skillupCampaign}, ${ids.skillupPage}, 'seed-session-0001', 599, 'PKR', ${attribution}, ${tx.json({ seeded: true, versionId: ids.skillupPageVersion })})
      ON CONFLICT (idempotency_key) DO NOTHING`;
  });
  console.log("Seeded GrowthOS SkillUp/Jalwa configuration and one reconciled SkillUp acquisition flow");
} finally { await sql.end(); }
