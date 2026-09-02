import { expect, test } from "@playwright/test";

const unifiedSkillUp = "http://skillup.localhost:3001/ai-games";
const platformAlias = "growthos-skillup.vercel.app";

test("the admin deployment also serves the configured public landing page", async ({ page, context }) => {
  await page.goto(unifiedSkillUp);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Learn AI skills through games");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://skillup.localhost/ai-games");
  await expect(page.getByRole("heading", { name: /Start your SkillUp subscription/i })).toBeVisible();
  const visitor = (await context.cookies()).find((cookie) => cookie.name === "growthos_visitor");
  expect(visitor?.value).toBeTruthy();
  expect(visitor?.httpOnly).toBe(true);
});

test("the unified product host keeps robots and sitemap behavior", async ({ request }) => {
  const robots = await request.get("http://skillup.localhost:3001/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap: http://skillup.localhost/sitemap.xml");
  const sitemap = await request.get("http://skillup.localhost:3001/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("http://skillup.localhost/ai-games");
});

test("a GrowthOS Vercel alias resolves by brand slug and stays noindex", async ({ request }) => {
  const page = await request.get("http://127.0.0.1:3001/ai-games", { headers: { host: platformAlias } });
  expect(page.status()).toBe(200);
  const html = await page.text();
  expect(html).toContain("Learn AI skills through games");
  expect(html).toMatch(/name="robots" content="noindex, nofollow"/i);

  const robots = await request.get("http://127.0.0.1:3001/robots.txt", { headers: { host: platformAlias } });
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /");

  const sitemap = await request.get("http://127.0.0.1:3001/sitemap.xml", { headers: { host: platformAlias } });
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("ai-games");
});
