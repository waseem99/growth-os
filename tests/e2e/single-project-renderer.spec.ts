import { expect, test } from "@playwright/test";

const unifiedSkillUp = "http://skillup.localhost:3001/ai-games";

test("the admin deployment also serves the configured public landing page", async ({ page, context }) => {
  await page.goto(unifiedSkillUp);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Learn AI skills through games");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://skillup.localhost/ai-games");
  await expect(page.getByRole("heading", { name: /Start your SkillUp subscription/i })).toBeVisible();
  const visitor = (await context.cookies()).find((cookie) => cookie.name === "growthos_visitor");
  expect(visitor?.value).toBeTruthy();
  expect(visitor?.httpOnly).toBe(true);
});
