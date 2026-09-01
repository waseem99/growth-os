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
  "ai_jobs"
];

try {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${requiredTables})
  `;
  const found = new Set(rows.map((row) => row.table_name));
  const missing = requiredTables.filter((name) => !found.has(name));
  if (missing.length) throw new Error(`Missing tables: ${missing.join(", ")}`);

  const [seed] = await sql<{ page_slug: string; hostname: string; offer_amount: string; version_number: number }[]>`
    SELECT lp.slug AS page_slug, d.hostname, ov.recurring_amount::text AS offer_amount, pv.version_number
    FROM page_publications pp
    JOIN landing_pages lp ON lp.id = pp.page_id
    JOIN domains d ON d.id = lp.domain_id
    JOIN page_versions pv ON pv.id = pp.version_id
    JOIN offer_versions ov ON ov.id = pv.offer_version_id
    WHERE lp.slug = 'ai-games'
  `;
  if (!seed || seed.hostname !== "skillup.localhost" || seed.offer_amount !== "599.00" || seed.version_number !== 1) {
    throw new Error("Seed/publication verification failed");
  }

  const constraint = await sql<{ constraint_name: string }[]>`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'page_publications'
      AND constraint_name = 'page_publications_version_belongs_to_page_fk'
  `;
  if (constraint.length !== 1) throw new Error("Publication/version ownership constraint is missing");

  console.log(`Verified ${requiredTables.length} domain tables and seeded publication`);
} finally {
  await sql.end();
}
