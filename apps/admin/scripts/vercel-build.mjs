import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "..");
const repoRoot = resolve(appDir, "../..");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.VERCEL_ENV === "production") {
  console.log("GrowthOS: applying production database migrations before build...");
  run("npm", ["run", "db:migrate"], repoRoot);
} else {
  console.log(`GrowthOS: skipping database migrations for VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}.`);
}

run("npx", ["next", "build"], appDir);
