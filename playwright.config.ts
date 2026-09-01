import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "npm run dev:admin -- --hostname 127.0.0.1",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "npm run dev:web -- --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
