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
  const migrations = await sql<{ version: string }[]>`SELECT version FROM growthos_schema_migrations ORDER BY version`; if (!migrations.some((row) => row.version === "0002_page_draft_seo")) throw new Error("Expected 0002_page_draft_seo migration to be recorded");
  console.log(`Verified ${requiredTables.length} tables, ordered migrations and two-brand domain/publication resolution data`);
} finally { await sql.end(); }
