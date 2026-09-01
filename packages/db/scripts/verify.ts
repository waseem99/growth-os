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
  for (const version of ["0002_page_draft_seo", "0003_tracking_context", "0004_experiment_integrity"]) if (!migrations.some((row) => row.version === version)) throw new Error(`Expected migration ${version} is not recorded`);
  const uniqueConstraints = await sql<{ table_name: string; definition: string }[]>`SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='u' AND conrelid IN ('analytics_events'::regclass, 'conversions'::regclass)`;
  if (!uniqueConstraints.some((row) => row.table_name === "analytics_events" && row.definition.includes("event_id"))) throw new Error("analytics_events.event_id uniqueness is missing");
  if (!uniqueConstraints.some((row) => row.table_name === "conversions" && row.definition.includes("idempotency_key"))) throw new Error("conversions.idempotency_key uniqueness is missing");
  const experimentIndexes = await sql<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('experiments_one_running_per_page_uidx','variants_experiment_page_version_uidx','variants_one_control_uidx')`;
  const experimentIndexNames = new Set(experimentIndexes.map((row) => row.indexname));
  for (const name of ["experiments_one_running_per_page_uidx", "variants_experiment_page_version_uidx", "variants_one_control_uidx"]) if (!experimentIndexNames.has(name)) throw new Error(`Experiment integrity index ${name} is missing`);

  const [experiment] = await sql<{ status: string; variants: string; allocation: string; controls: string }[]>`
    SELECT e.status, count(v.id)::text AS variants, coalesce(sum(v.allocation),0)::text AS allocation, count(*) FILTER (WHERE v.is_control)::text AS controls
    FROM experiments e JOIN variants v ON v.experiment_id=e.id
    WHERE e.id='00000000-0000-4000-8000-000000000900'
    GROUP BY e.id, e.status`;
  if (!experiment || experiment.status !== "paused" || experiment.variants !== "2" || experiment.allocation !== "100" || experiment.controls !== "1") throw new Error("Seed experiment variants do not reconcile to one 100% allocation");

  const [seedEvents] = await sql<{ landing_views: string; sessions: string; cta_clicks: string; signup_starts: string; checkout_starts: string; control_variant_events: string }[]>`
    SELECT
      count(*) FILTER (WHERE event_name='landing_view')::text AS landing_views,
      count(DISTINCT session_id) FILTER (WHERE event_name='landing_view')::text AS sessions,
      count(*) FILTER (WHERE event_name='cta_click')::text AS cta_clicks,
      count(*) FILTER (WHERE event_name='signup_start')::text AS signup_starts,
      count(*) FILTER (WHERE event_name='checkout_start')::text AS checkout_starts,
      count(*) FILTER (WHERE variant_id='00000000-0000-4000-8000-000000000901')::text AS control_variant_events
    FROM analytics_events
    WHERE page_id='00000000-0000-4000-8000-000000000050'
      AND properties->>'seeded'='true'
      AND coalesce(properties->>'testTraffic','false') <> 'true'`;
  const [testTraffic] = await sql<{ events: string; variant_id: string | null }[]>`
    SELECT count(*)::text AS events, min(variant_id::text) AS variant_id FROM analytics_events
    WHERE page_id='00000000-0000-4000-8000-000000000050' AND properties->>'seeded'='true' AND properties->>'testTraffic'='true'`;
  const [seedConversions] = await sql<{ subscriptions: string; revenue: string; currency: string; variant_id: string | null }[]>`
    SELECT count(*) FILTER (WHERE event_name='subscription_started')::text AS subscriptions, coalesce(sum(value),0)::text AS revenue, min(currency) AS currency, min(variant_id::text) AS variant_id
    FROM conversions WHERE page_id='00000000-0000-4000-8000-000000000050' AND properties->>'seeded'='true' AND coalesce(properties->>'testTraffic','false') <> 'true'`;
  if (!seedEvents || seedEvents.landing_views !== "1" || seedEvents.sessions !== "1" || seedEvents.cta_clicks !== "1" || seedEvents.signup_starts !== "1" || seedEvents.checkout_starts !== "1" || seedEvents.control_variant_events !== "4") throw new Error("Seed production analytics event funnel does not reconcile");
  if (!testTraffic || testTraffic.events !== "1" || testTraffic.variant_id !== "00000000-0000-4000-8000-000000000902") throw new Error("Seed experiment test traffic is not isolated on variant B");
  if (!seedConversions || seedConversions.subscriptions !== "1" || seedConversions.revenue !== "599.00" || seedConversions.currency !== "PKR" || seedConversions.variant_id !== "00000000-0000-4000-8000-000000000901") throw new Error("Seed experiment conversion does not reconcile to control variant");

  const pageDocuments = await sql<{ slug: string; schema_version: string | null; blocks: string }[]>`
    SELECT lp.slug, pv.content->>'schemaVersion' AS schema_version, jsonb_array_length(pv.content->'blocks')::text AS blocks
    FROM page_publications pp JOIN landing_pages lp ON lp.id=pp.page_id JOIN page_versions pv ON pv.id=pp.version_id
    WHERE lp.id IN ('00000000-0000-4000-8000-000000000050','00000000-0000-4000-8000-000000000150') ORDER BY lp.slug`;
  if (pageDocuments.length !== 2 || pageDocuments.some((row) => row.schema_version !== "1" || Number(row.blocks) < 1)) throw new Error("Seed published pages must contain valid-shaped non-empty page documents");

  console.log(`Verified ${requiredTables.length} tables, ordered migrations, experiment integrity/stickiness context, test-traffic isolation and a reconciled acquisition funnel`);
} finally { await sql.end(); }
