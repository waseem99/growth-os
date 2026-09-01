import postgres from "postgres";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 1, prepare: false });
const requiredTables = ["app_users","brands","domains","offers","offer_versions","campaigns","templates","landing_pages","page_versions","page_publications","assets","asset_usages","experiments","variants","analytics_events","conversions","integrations","audit_logs","ai_jobs"];
try {
  const rows = await sql<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(${requiredTables})`;
  const found = new Set(rows.map((row) => row.table_name)); const missing = requiredTables.filter((name) => !found.has(name)); if (missing.length) throw new Error(`Missing tables: ${missing.join(", ")}`);
  const publications = await sql<{ brand_slug: string; page_slug: string; hostname: string; version_number: number }[]>`SELECT b.slug AS brand_slug, lp.slug AS page_slug, d.hostname, pv.version_number FROM page_publications pp JOIN landing_pages lp ON lp.id=pp.page_id JOIN brands b ON b.id=lp.brand_id JOIN domains d ON d.id=lp.domain_id JOIN page_versions pv ON pv.id=pp.version_id WHERE b.slug IN ('skillup','jalwa') ORDER BY b.slug`;
  if (publications.length !== 2) throw new Error("Expected published pages for SkillUp and Jalwa");
  const jalwa = publications.find((row) => row.brand_slug === "jalwa"); const skillup = publications.find((row) => row.brand_slug === "skillup");
  if (!jalwa || jalwa.hostname !== "jalwa.localhost" || jalwa.page_slug !== "watch") throw new Error("Jalwa host/page seed verification failed");
  if (!skillup || skillup.hostname !== "skillup.localhost" || skillup.page_slug !== "ai-games") throw new Error("SkillUp host/page seed verification failed");
  const [offer] = await sql<{ amount: string }[]>`SELECT recurring_amount::text AS amount FROM offer_versions WHERE id='00000000-0000-4000-8000-000000000021'`; if (!offer || offer.amount !== "599.00") throw new Error("SkillUp offer verification failed");
  const constraint = await sql<{ constraint_name: string }[]>`SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='page_publications' AND constraint_name='page_publications_version_belongs_to_page_fk'`; if (constraint.length !== 1) throw new Error("Publication/version ownership constraint is missing");
  const seoColumn = await sql<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_name='landing_pages' AND column_name='draft_seo'`; if (seoColumn.length !== 1) throw new Error("landing_pages.draft_seo migration is missing");
  const trackingColumns = await sql<{ column_name: string }[]>`SELECT column_name FROM information_schema.columns WHERE table_name='analytics_events' AND column_name IN ('source','medium','campaign_name','term','content')`;
  if (trackingColumns.length !== 5) throw new Error("analytics_events UTM context migration is incomplete");
  const migrations = await sql<{ version: string }[]>`SELECT version FROM growthos_schema_migrations ORDER BY version`;
  if (!migrations.some((row) => row.version === "0002_page_draft_seo") || !migrations.some((row) => row.version === "0003_tracking_context")) throw new Error("Expected ordered GrowthOS migrations are not recorded");
  const uniqueConstraints = await sql<{ table_name: string; definition: string }[]>`SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='u' AND conrelid IN ('analytics_events'::regclass, 'conversions'::regclass)`;
  if (!uniqueConstraints.some((row) => row.table_name === "analytics_events" && row.definition.includes("event_id"))) throw new Error("analytics_events.event_id uniqueness is missing");
  if (!uniqueConstraints.some((row) => row.table_name === "conversions" && row.definition.includes("idempotency_key"))) throw new Error("conversions.idempotency_key uniqueness is missing");

  const [seedEvents] = await sql<{ landing_views: string; sessions: string; cta_clicks: string; signup_starts: string; checkout_starts: string }[]>`
    SELECT
      count(*) FILTER (WHERE event_name='landing_view')::text AS landing_views,
      count(DISTINCT session_id) FILTER (WHERE event_name='landing_view')::text AS sessions,
      count(*) FILTER (WHERE event_name='cta_click')::text AS cta_clicks,
      count(*) FILTER (WHERE event_name='signup_start')::text AS signup_starts,
      count(*) FILTER (WHERE event_name='checkout_start')::text AS checkout_starts
    FROM analytics_events
    WHERE page_id='00000000-0000-4000-8000-000000000050' AND properties->>'seeded'='true'`;
  const [seedConversions] = await sql<{ subscriptions: string; revenue: string; currency: string }[]>`
    SELECT count(*) FILTER (WHERE event_name='subscription_started')::text AS subscriptions, coalesce(sum(value),0)::text AS revenue, min(currency) AS currency
    FROM conversions WHERE page_id='00000000-0000-4000-8000-000000000050' AND properties->>'seeded'='true'`;
  if (!seedEvents || seedEvents.landing_views !== "1" || seedEvents.sessions !== "1" || seedEvents.cta_clicks !== "1" || seedEvents.signup_starts !== "1" || seedEvents.checkout_starts !== "1") throw new Error("Seed analytics event funnel does not reconcile");
  if (!seedConversions || seedConversions.subscriptions !== "1" || seedConversions.revenue !== "599.00" || seedConversions.currency !== "PKR") throw new Error("Seed analytics conversion does not reconcile");

  console.log(`Verified ${requiredTables.length} tables, ordered migrations, analytics context/idempotency, two-brand publication resolution and a reconciled acquisition funnel`);
} finally { await sql.end(); }
