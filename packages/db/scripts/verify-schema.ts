import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });
const requiredTables = [
  "app_users",
  "brands",
  "domains",
  "offers",
  "offer_versions",
  "campaigns",
  "templates",
  "landing_pages",
  "page_versions",
  "page_publications",
  "assets",
  "asset_usages",
  "experiments",
  "variants",
  "analytics_events",
  "conversions",
  "integrations",
  "audit_logs",
  "ai_jobs",
  "rate_limit_buckets",
  "product_packages",
  "landing_variations",
  "landing_variation_versions",
  "landing_variation_publications",
  "conversion_event_rules"
];
const requiredMigrations = [
  "0001_initial",
  "0002_page_draft_seo",
  "0003_tracking_context",
  "0004_experiment_integrity",
  "0005_operability",
  "0006_dynamic_campaigns",
  "0007_conversion_rules"
];

try {
  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name = ANY(${requiredTables})`;
  const foundTables = new Set(tables.map((row) => row.table_name));
  const missingTables = requiredTables.filter((name) => !foundTables.has(name));
  if (missingTables.length) throw new Error(`Missing tables: ${missingTables.join(", ")}`);

  const migrations = await sql<{ version: string }[]>`
    SELECT version FROM growthos_schema_migrations ORDER BY version`;
  const applied = new Set(migrations.map((row) => row.version));
  const missingMigrations = requiredMigrations.filter((version) => !applied.has(version));
  if (missingMigrations.length) throw new Error(`Missing migrations: ${missingMigrations.join(", ")}`);

  const publicationConstraint = await sql<{ constraint_name: string }[]>`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name='page_publications'
      AND constraint_name='page_publications_version_belongs_to_page_fk'`;
  if (publicationConstraint.length !== 1) throw new Error("Publication/version ownership constraint is missing");

  const trackingColumns = await sql<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name='analytics_events'
      AND column_name IN ('source','medium','campaign_name','term','content')`;
  if (trackingColumns.length !== 5) throw new Error("analytics_events UTM context migration is incomplete");

  const uniqueConstraints = await sql<{ table_name: string; definition: string }[]>`
    SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE contype='u'
      AND conrelid IN ('analytics_events'::regclass, 'conversions'::regclass)`;
  if (!uniqueConstraints.some((row) => row.table_name === "analytics_events" && row.definition.includes("event_id"))) {
    throw new Error("analytics_events.event_id uniqueness is missing");
  }
  if (!uniqueConstraints.some((row) => row.table_name === "conversions" && row.definition.includes("idempotency_key"))) {
    throw new Error("conversions.idempotency_key uniqueness is missing");
  }

  const experimentIndexes = await sql<{ indexname: string }[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname='public'
      AND indexname IN ('experiments_one_running_per_page_uidx','variants_experiment_page_version_uidx','variants_one_control_uidx')`;
  const experimentIndexNames = new Set(experimentIndexes.map((row) => row.indexname));
  for (const name of ["experiments_one_running_per_page_uidx", "variants_experiment_page_version_uidx", "variants_one_control_uidx"]) {
    if (!experimentIndexNames.has(name)) throw new Error(`Experiment integrity index ${name} is missing`);
  }

  const variationOwnership = await sql<{ constraint_name: string }[]>`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name='landing_variation_publications'
      AND constraint_name='landing_variation_publications_version_ownership_fk'`;
  if (variationOwnership.length !== 1) throw new Error("Variation publication ownership constraint is missing");

  const brandOwnership = await sql<{ constraint_name: string }[]>`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name='landing_variations'
      AND constraint_name='landing_variations_page_brand_fk'`;
  if (brandOwnership.length !== 1) throw new Error("Variation/page brand ownership constraint is missing");

  const rulesConstraints = await sql<{ constraint_name: string }[]>`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'conversion_event_rules'
      AND constraint_name = 'conversion_rules_package_brand_fk'`;
  if (rulesConstraints.length !== 1) throw new Error("Conversion rule product ownership constraint missing");

  const ownershipTriggers = await sql<{ tgname: string }[]>`
    SELECT tgname FROM pg_trigger
    WHERE NOT tgisinternal AND tgname IN (
      'growthos_product_packages_offer_owner',
      'growthos_variation_versions_asset_owner'
    )`;
  if (ownershipTriggers.length !== 2) throw new Error("V2 product ownership triggers missing");

  const ruleIndexes = await sql<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE indexname = 'conversion_event_rules_scope_uidx'`;
  if (ruleIndexes.length !== 1) throw new Error("Scoped event rule uniqueness missing");

  console.log(`Production schema verified: ${requiredTables.length} tables and ${requiredMigrations.length} migrations`);
} finally {
  await sql.end();
}
