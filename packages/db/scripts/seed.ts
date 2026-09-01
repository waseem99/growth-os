import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });

const ids = {
  user: "00000000-0000-4000-8000-000000000001",
  brand: "00000000-0000-4000-8000-000000000010",
  domain: "00000000-0000-4000-8000-000000000011",
  offer: "00000000-0000-4000-8000-000000000020",
  offerVersion: "00000000-0000-4000-8000-000000000021",
  campaign: "00000000-0000-4000-8000-000000000030",
  template: "00000000-0000-4000-8000-000000000040",
  page: "00000000-0000-4000-8000-000000000050",
  pageVersion: "00000000-0000-4000-8000-000000000051"
} as const;

try {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO app_users (id, email, name, role)
      VALUES (${ids.user}, 'admin@growthos.local', 'GrowthOS Demo Admin', 'owner')
      ON CONFLICT (email) DO NOTHING`;

    await tx`INSERT INTO brands (id, name, slug, status, theme, defaults, created_by, updated_by)
      VALUES (${ids.brand}, 'SkillUp', 'skillup', 'active', ${tx.json({ primary: "#6030ff", background: "#ffffff" })}, ${tx.json({ locale: "en-PK" })}, ${ids.user}, ${ids.user})
      ON CONFLICT (slug) DO NOTHING`;

    await tx`INSERT INTO domains (id, brand_id, hostname, status, is_primary)
      VALUES (${ids.domain}, ${ids.brand}, 'skillup.localhost', 'verified', true)
      ON CONFLICT (hostname) DO NOTHING`;

    await tx`INSERT INTO offers (id, brand_id, name, slug)
      VALUES (${ids.offer}, ${ids.brand}, 'SkillUp Premium', 'premium')
      ON CONFLICT (brand_id, slug) DO NOTHING`;

    await tx`INSERT INTO offer_versions (id, offer_id, version_number, currency, initial_amount, recurring_amount, billing_interval, trial_days, auto_renew, benefit, terms, created_by)
      VALUES (${ids.offerVersion}, ${ids.offer}, 1, 'PKR', 1, 599, 'month', 1, true, ${tx.json({ kind: "subscription" })}, ${tx.json({ disclosure: "PKR 1 initial charge, then PKR 599/month after the trial." })}, ${ids.user})
      ON CONFLICT (offer_id, version_number) DO NOTHING`;

    await tx`INSERT INTO campaigns (id, brand_id, offer_version_id, name, platform, objective, status, utm_defaults, created_by, updated_by)
      VALUES (${ids.campaign}, ${ids.brand}, ${ids.offerVersion}, 'SkillUp Demo Acquisition', 'tiktok', 'subscription', 'draft', ${tx.json({ source: "tiktok", medium: "paid_social" })}, ${ids.user}, ${ids.user})
      ON CONFLICT (id) DO NOTHING`;

    await tx`INSERT INTO templates (id, brand_id, name, slug, schema_version, content)
      VALUES (${ids.template}, ${ids.brand}, 'Subscription Acquisition', 'subscription-acquisition', 1, ${tx.json({ blocks: [] })})
      ON CONFLICT (id) DO NOTHING`;

    await tx`INSERT INTO landing_pages (id, brand_id, domain_id, campaign_id, template_id, name, slug, conversion_goal, draft_content, created_by, updated_by)
      VALUES (${ids.page}, ${ids.brand}, ${ids.domain}, ${ids.campaign}, ${ids.template}, 'SkillUp AI Games', 'ai-games', 'subscription_started', ${tx.json({ blocks: [] })}, ${ids.user}, ${ids.user})
      ON CONFLICT (id) DO NOTHING`;

    await tx`INSERT INTO page_versions (id, page_id, offer_version_id, version_number, schema_version, content, seo, publish_note, created_by)
      VALUES (${ids.pageVersion}, ${ids.page}, ${ids.offerVersion}, 1, 1, ${tx.json({ blocks: [] })}, ${tx.json({ title: "Learn AI Skills through games" })}, 'Seed version', ${ids.user})
      ON CONFLICT (page_id, version_number) DO NOTHING`;

    await tx`INSERT INTO page_publications (page_id, version_id, published_by)
      VALUES (${ids.page}, ${ids.pageVersion}, ${ids.user})
      ON CONFLICT (page_id) DO UPDATE SET version_id = EXCLUDED.version_id, published_at = now(), published_by = EXCLUDED.published_by`;
  });
  console.log("Seeded GrowthOS demo data");
} finally {
  await sql.end();
}
