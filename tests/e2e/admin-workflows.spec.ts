import { expect, test } from "@playwright/test";
import { getDatabase } from "@growth-os/db";

const admin = "http://127.0.0.1:3001";
const publicWeb = "http://skillup.localhost:3000";
const disposable = process.env.DATABASE_URL?.includes("localhost:5432/growthos") ?? false;

test.describe("GrowthOS Admin operator acceptance (disposable CI database only)", () => {
  test.skip(!disposable || !process.env.INTERNAL_ADMIN_EMAIL || !process.env.INTERNAL_ADMIN_PASSWORD,
    "Requires dedicated CI PostgreSQL fixtures and synthetic internal credentials");

  test("unauthenticated visitors cannot access protected Admin screens", async ({ page }) => {
    for (const path of ["/", "/brands", "/campaigns", "/packages", "/variations", "/pages", "/analytics"]) {
      await page.goto(admin + path);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByRole("heading", { name: "Sign in to continue." })).toBeVisible();
    }
  });

  test("owner can configure a campaign, publish versions, and roll back a banner", async ({ page }) => {
    test.setTimeout(180_000);
    const suffix = Date.now().toString(36);
    const brandName = `QA Product ${suffix}`;
    const brandSlug = `qa-product-${suffix}`;
    const campaignName = `QA V2 Meta Campaign ${suffix}`;
    const packageCode = `qa-${suffix}`;
    const packageName = `QA Monthly ${suffix}`;
    const pageName = `QA Landing ${suffix}`;
    const pageSlug = `qa-landing-${suffix}`;
    const parameter = `qa-banner-${suffix}`;
    const headlineV1 = `Campaign headline first ${suffix}`;
    const headlineV2 = `Campaign headline updated ${suffix}`;
    const { client } = getDatabase();

    try {
      await page.goto(admin + "/login");
      await page.locator('input[name="email"]').fill(process.env.INTERNAL_ADMIN_EMAIL!);
      await page.locator('input[name="password"]').fill(process.env.INTERNAL_ADMIN_PASSWORD!);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(admin + "/", { timeout: 25_000 });
      await expect(page.locator("body")).not.toContainText("Application error");
      await test.info().attach("01-owner-dashboard", { body: await page.screenshot(), contentType: "image/png" });

      // Brand onboarding through the browser, without touching real product records.
      await page.goto(admin + "/brands");
      const brandForm = page.locator("form.brand-create");
      await brandForm.locator('input[name="name"]').fill(brandName);
      await brandForm.locator('input[name="slug"]').fill(brandSlug);
      await brandForm.getByRole("button", { name: "Add brand" }).click();
      await expect(page.locator(".brand-grid")).toContainText(brandName);
      const [brand] = await client<{ id: string }[]>`SELECT id::text FROM brands WHERE slug = ${brandSlug}`;
      expect(brand?.id).toBeTruthy();

      // New campaign on the seeded SkillUp product, which already has a verified CI domain.
      const skillupBrandId = "00000000-0000-4000-8000-000000000010";
      await page.goto(admin + "/campaigns");
      const campaignForm = page.locator('form:has(input[name="name"])').first();
      await campaignForm.locator('input[name="name"]').fill(campaignName);
      await campaignForm.locator('select[name="brandId"]').selectOption(skillupBrandId);
      await campaignForm.locator('select[name="platform"]').selectOption("meta");
      await campaignForm.locator('select[name="objective"]').selectOption("subscription");
      await campaignForm.getByRole("button", { name: "Create campaign" }).click();
      await expect(page.locator("body")).toContainText(campaignName);
      const [campaign] = await client<{ id: string }[]>`SELECT id::text FROM campaigns WHERE name = ${campaignName}`;
      expect(campaign?.id).toBeTruthy();

      // Package must begin as draft and only become publicly selectable when activated.
      await page.goto(admin + "/packages");
      const packageForm = page.locator('form:has(input[name="packageCode"])');
      await packageForm.locator('select[name="brandId"]').selectOption(skillupBrandId);
      await packageForm.locator('input[name="packageCode"]').fill(packageCode);
      await packageForm.locator('input[name="name"]').fill(packageName);
      await packageForm.locator('input[name="price"]').fill("566");
      await packageForm.locator('select[name="currency"]').selectOption("PKR");
      await packageForm.getByRole("button", { name: "Save draft package" }).click();
      const packageCard = page.locator("section.settings-card").filter({ hasText: packageName });
      await expect(packageCard).toContainText("draft");
      await packageCard.locator('select[name="status"]').selectOption("active");
      await packageCard.getByRole("button", { name: "Update status" }).click();
      await expect(packageCard).toContainText("active");
      const [pkg] = await client<{ id: string; status: string }[]>`
        SELECT id::text, status FROM product_packages WHERE package_code = ${packageCode} AND brand_id = ${skillupBrandId}`;
      expect(pkg?.status).toBe("active");

      // Create and publish a new page through the Admin UI.
      await page.goto(admin + "/pages");
      const pageForm = page.locator('form:has(input[name="name"])').first();
      await pageForm.locator('input[name="name"]').fill(pageName);
      await pageForm.locator('input[name="slug"]').fill(pageSlug);
      await pageForm.locator('select[name="brandId"]').selectOption(skillupBrandId);
      await pageForm.locator('select[name="campaignId"]').selectOption(campaign!.id);
      await pageForm.getByRole("button", { name: "Create matching page" }).click();
      await expect(page).toHaveURL(/\/pages\/[0-9a-f-]{36}$/, { timeout: 20_000 });
      const pageId = page.url().split("/").pop()!;
      await page.goto(`${admin}/pages/${pageId}/publishing`);
      await expect(page.getByRole("heading", { name: pageName })).toBeVisible();
      await page.getByRole("button", { name: "Publish immutable version" }).click();
      await expect(page.locator(".publish-message")).toContainText(/published|success|live/i, { timeout: 20_000 });
      const [published] = await client<{ version_id: string }[]>`
        SELECT version_id::text FROM page_publications WHERE page_id = ${pageId}`;
      expect(published?.version_id).toBeTruthy();

      // Campaign variation: draft -> publish -> new version -> pause -> rollback.
      await page.goto(admin + "/variations");
      const variationForm = page.locator('form:has(input[name="parameterKey"])');
      await variationForm.locator('select[name="pageId"]').selectOption(pageId);
      await variationForm.locator('input[name="parameterKey"]').fill(parameter);
      await variationForm.locator('select[name="campaignId"]').selectOption(campaign!.id);
      await variationForm.locator('input[name="headline"]').fill(headlineV1);
      await variationForm.getByRole("button", { name: "Save draft variation" }).click();
      const variationCard = page.locator("section.settings-card").filter({ hasText: parameter });
      await expect(variationCard).toContainText("draft");
      await variationCard.getByRole("button", { name: "Publish latest version" }).click();
      await expect(variationCard).toContainText("active");
      const campaignUrl = `${publicWeb}/${pageSlug}?utm=M&package=${packageCode}&parameter=${parameter}`;
      await page.goto(campaignUrl);
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(headlineV1);

      await page.goto(admin + "/variations");
      const variationV2 = page.locator("section.settings-card").filter({ hasText: parameter });
      await variationV2.locator("summary", { hasText: "Edit creative" }).click();
      await variationV2.locator('form:has(input[name="expectedVersion"]) input[name="headline"]').fill(headlineV2);
      await variationV2.getByRole("button", { name: "Save new draft" }).click();
      await expect(variationV2).toContainText("Latest draft v2");
      await variationV2.getByRole("button", { name: "Publish latest version" }).click();
      await page.goto(campaignUrl);
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(headlineV2);

      await page.goto(admin + "/variations");
      const variationPaused = page.locator("section.settings-card").filter({ hasText: parameter });
      await variationPaused.getByRole("button", { name: "Pause variation" }).click();
      await expect(variationPaused).toContainText("paused");
      await page.goto(campaignUrl);
      await expect(page.getByRole("heading", { level: 1 }).first()).not.toContainText(headlineV2);

      await page.goto(admin + "/variations");
      const variationRollback = page.locator("section.settings-card").filter({ hasText: parameter });
      await variationRollback.locator('select[name="versionId"]').selectOption({ label: /Version 1/ });
      await variationRollback.getByRole("button", { name: "Rollback to selected version" }).click();
      await expect(variationRollback).toContainText("active");
      await page.goto(campaignUrl);
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(headlineV1);
      await test.info().attach("02-rollback-public-landing", { body: await page.screenshot(), contentType: "image/png" });

      const [audit] = await client<{ n: number }[]>`
        SELECT count(*)::int AS n FROM audit_logs
        WHERE action IN ('brand.created','campaign.created','product_package.created','page.published',
          'variation.created','variation.published','variation.paused','variation.rolled_back')`;
      expect(audit.n).toBeGreaterThanOrEqual(8);
    } finally {
      await client.end();
    }
  });

  test("analyst may view analytics but cannot manage brands, packages or variations", async ({ page }) => {
    const { client } = getDatabase();
    const email = process.env.INTERNAL_ADMIN_EMAIL!;
    await page.goto(admin + "/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(process.env.INTERNAL_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(admin + "/", { timeout: 25_000 });
    try {
      await client`UPDATE app_users SET role = 'analyst' WHERE email = ${email}`;
      await page.goto(admin + "/packages");
      await expect(page.locator('form:has(input[name="packageCode"])')).toHaveCount(0);
      await page.goto(admin + "/variations");
      await expect(page.locator('form:has(input[name="parameterKey"])')).toHaveCount(0);
      const forbidden = await page.goto(admin + "/brands");
      expect(forbidden?.status()).not.toBe(200);
      await page.goto(admin + "/analytics");
      await expect(page.locator("body")).toContainText(/analytics|performance|conversions/i);
    } finally {
      await client`UPDATE app_users SET role = 'owner' WHERE email = ${email}`;
      await client.end();
    }
  });
});
