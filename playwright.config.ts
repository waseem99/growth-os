import { defineConfig } from "@playwright/test";

const productionMode = process.env.E2E_USE_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: productionMode ? "npm run start -w @growth-os/admin -- --hostname 127.0.0.1" : "npm run dev:admin -- --hostname 127.0.0.1",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: productionMode ? "npm run start -w @growth-os/web -- --hostname 127.0.0.1" : "npm run dev:web -- --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
