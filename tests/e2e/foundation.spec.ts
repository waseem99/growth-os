import { expect, test } from "@playwright/test";

test("admin and public apps are isolated and reachable", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Acquisition operations");

  await page.goto("http://127.0.0.1:3000");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Public landing-page engine ready");
});
