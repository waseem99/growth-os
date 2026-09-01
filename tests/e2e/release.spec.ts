import { expect, test } from "@playwright/test";

const skillup = "http://skillup.localhost:3000/ai-games";
const variantB = "00000000-0000-4000-8000-000000000902";

test("published SkillUp acquisition page resolves on its configured host with production SEO", async ({ page }) => {
  await page.goto(skillup);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Learn AI skills through games");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://skillup.localhost/ai-games");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots ?? "").not.toContain("noindex");
  await expect(page.getByText(/JazzCash/i).first()).toBeVisible();
});

test("published page remains usable at a paid-social mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(skillup);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Pay Now/i }).first()).toBeVisible();
});

test("forced experiment QA uses the same canonical URL but is noindex", async ({ page }) => {
  await page.goto(`${skillup}?go_test=1&go_variant=${variantB}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://skillup.localhost/ai-games");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots ?? "").toContain("noindex");
  await expect(page.getByText(/Rancher/i).first()).toBeVisible();
});

test("host sitemap and robots endpoints remain available", async ({ request }) => {
  const sitemap = await request.get("http://skillup.localhost:3000/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("http://skillup.localhost/ai-games");
  const robots = await request.get("http://skillup.localhost:3000/robots.txt");
  expect(robots.status()).toBe(200);
});
