import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });
const migrationsDir = new URL("../migrations/", import.meta.url);

try {
  await sql`CREATE TABLE IF NOT EXISTS growthos_schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const files = (await readdir(migrationsDir)).filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file)).sort();
  if (!files.length) throw new Error("No database migrations found");
  const appliedRows = await sql<{ version: string }[]>`SELECT version FROM growthos_schema_migrations`;
  const applied = new Set(appliedRows.map((row) => row.version));

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) {
      console.log(`Migration ${version} already applied`);
      continue;
    }
    const migration = await readFile(new URL(file, migrationsDir), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(migration);
      await tx`INSERT INTO growthos_schema_migrations (version) VALUES (${version})`;
    });
    console.log(`Applied migration ${version}`);
  }
} finally {
  await sql.end();
}
