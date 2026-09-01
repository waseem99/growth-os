import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });
const migrationVersion = "0001_initial";
const migration = await readFile(new URL(`../migrations/${migrationVersion}.sql`, import.meta.url), "utf8");

try {
  await sql`CREATE TABLE IF NOT EXISTS growthos_schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const existing = await sql<{ version: string }[]>`SELECT version FROM growthos_schema_migrations WHERE version = ${migrationVersion}`;
  if (existing.length === 0) {
    await sql.begin(async (tx) => {
      await tx.unsafe(migration);
      await tx`INSERT INTO growthos_schema_migrations (version) VALUES (${migrationVersion})`;
    });
    console.log(`Applied migration ${migrationVersion}`);
  } else {
    console.log(`Migration ${migrationVersion} already applied`);
  }
} finally {
  await sql.end();
}
