const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

let hostname = "";
try {
  hostname = new URL(databaseUrl).hostname.toLowerCase();
} catch {
  throw new Error("DATABASE_URL must be a valid URL");
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);
const explicitlyAllowed = process.env.ALLOW_DEMO_SEED === "1";

if (!localHosts.has(hostname) && !explicitlyAllowed) {
  throw new Error(
    `Refusing to seed non-local database host ${hostname}. Set ALLOW_DEMO_SEED=1 only for an intentionally disposable preview/demo database.`
  );
}

if (process.env.NODE_ENV === "production" && !explicitlyAllowed) {
  throw new Error("Refusing to seed while NODE_ENV=production. Production data must be created through the GrowthOS admin workflow.");
}

console.log(`Demo seed safety check passed for ${hostname}`);
