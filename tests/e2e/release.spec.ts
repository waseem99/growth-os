import { expect, test } from "@playwright/test";

const skillup = "http://skillup.localhost:3000/ai-games";
const jalwa = "http://jalwa.localhost:3000/watch";
const variantB = "00000000-0000-4000-8000-000000000902";
const ids = {
  brandId: "00000000-0000-4000-8000-000000000010",
  campaignId: "00000000-0000-4000-8000-000000000030",
  pageId: "00000000-0000-4000-8000-000000000050",
  versionId: "00000000-0000-4000-8000-000000000051",
  variantId: "00000000-0000-4000-8000-000000000901"
};

test("published SkillUp acquisition page resolves on its configured host with production SEO", async ({ page }) => {
  await page.goto(skillup);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Learn AI skills through games");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://skillup.localhost/ai-games");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots ?? "").not.toContain("noindex");
  await expect(page.getByRole("heading", { name: /Start your SkillUp subscription/i })).toBeVisible();
  await expect(page.getByText(/PKR 599/).first()).toBeVisible();
});

test("a second brand resolves independently on its configured host and path", async ({ page }) => {
  await page.goto(jalwa);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Entertainment worth watching");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://jalwa.localhost/watch");
  await expect(page.getByRole("link", { name: /Watch now/i }).first()).toBeVisible();
});

test("published page remains usable at a paid-social mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(skillup);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue/i }).first()).toBeVisible();
});

test("forced experiment QA uses the same canonical URL but is noindex", async ({ page }) => {
  await page.goto(`${skillup}?go_test=1&go_variant=${variantB}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://skillup.localhost/ai-games");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots ?? "").toContain("noindex");
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Build practical AI skills faster");
});

test("host sitemap and robots endpoints remain available", async ({ request }) => {
  const sitemap = await request.get("http://skillup.localhost:3000/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("http://skillup.localhost/ai-games");
  const robots = await request.get("http://skillup.localhost:3000/robots.txt");
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain("Disallow: /api/");
  expect(robotsText).toContain("Sitemap: http://skillup.localhost/sitemap.xml");
});

test("event and downstream conversion ingestion preserve campaign context and idempotency", async ({ request }) => {
  const occurredAt = new Date().toISOString();
  const eventPayload = {
    eventId: "release-check-event-0001",
    eventName: "cta_click",
    occurredAt,
    ...ids,
    creativeId: "release-creative-01",
    sessionId: "release-session-0001",
    anonymousId: "release-anon-0001",
    source: "tiktok",
    medium: "paid_social",
    campaignName: "skillup_release_check",
    content: "release-creative-01",
    properties: { releaseCheck: true, testTraffic: true }
  };

  const event = await request.post("http://skillup.localhost:3000/api/events", { data: eventPayload });
  expect([200, 201]).toContain(event.status());
  expect(event.headers()["x-request-id"]).toBeTruthy();
  expect(await event.json()).toMatchObject({ accepted: true });

  const duplicateEvent = await request.post("http://skillup.localhost:3000/api/events", { data: eventPayload });
  expect(duplicateEvent.status()).toBe(200);
  expect(await duplicateEvent.json()).toMatchObject({ accepted: true, duplicate: true });

  const attributionTouch = {
    source: "tiktok",
    medium: "paid_social",
    campaign: "skillup_release_check",
    term: null,
    content: "release-creative-01",
    creativeId: "release-creative-01",
    capturedAt: occurredAt
  };
  const conversionPayload = {
    idempotencyKey: "release-check-conversion-0001",
    eventName: "subscription_started",
    occurredAt,
    ...ids,
    sessionId: "release-session-0001",
    value: 599,
    currency: "PKR",
    attribution: { firstTouch: attributionTouch, lastTouch: attributionTouch },
    properties: { releaseCheck: true, testTraffic: true }
  };

  const unauthorized = await request.post("http://skillup.localhost:3000/api/conversions", {
    data: conversionPayload,
    headers: { authorization: "Bearer definitely-wrong" }
  });
  expect(unauthorized.status()).toBe(401);

  const secret = process.env.CONVERSION_INGEST_SECRET;
  expect(secret).toBeTruthy();
  const conversion = await request.post("http://skillup.localhost:3000/api/conversions", {
    data: conversionPayload,
    headers: { authorization: `Bearer ${secret}` }
  });
  expect([200, 201]).toContain(conversion.status());
  expect(conversion.headers()["x-request-id"]).toBeTruthy();
  expect(await conversion.json()).toMatchObject({ accepted: true });

  const duplicateConversion = await request.post("http://skillup.localhost:3000/api/conversions", {
    data: conversionPayload,
    headers: { authorization: `Bearer ${secret}` }
  });
  expect(duplicateConversion.status()).toBe(200);
  expect(await duplicateConversion.json()).toMatchObject({ accepted: true, duplicate: true });
});
