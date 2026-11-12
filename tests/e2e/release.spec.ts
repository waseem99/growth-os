import { expect, test } from "@playwright/test";
import { getDatabase } from "@growth-os/db";

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

test("V2 client URL selects the Ranchers banner configuration and approved SkillUp package", async ({ page }) => {
  const response = await page.goto(`${skillup}?utm=M&package=1&parameter=ranchers`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Ranchers acquisition campaign");
  await expect(page.getByText(/PKR 566/).first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "http://skillup.localhost/ai-games");
});

test("unknown banner code uses the default approved creative", async ({ page }) => {
  const response = await page.goto(`${skillup}?utm=T&parameter=unknown-campaign`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Learn AI skills through games");
});

test("an unknown or cross-product package must never display another product's price", async ({ page }) => {
  const response = await page.goto(`${jalwa}?package=1&parameter=ranchers`);
  expect(response?.status()).toBe(404);
});

test("conflicting or duplicated campaign source parameters are rejected", async ({ page }) => {
  const first = await page.goto(`${skillup}?utm=M&utm_source=tiktok&package=1&parameter=ranchers`);
  expect(first?.status()).toBe(404);
  const duplicate = await page.goto(`${skillup}?package=1&package=2&parameter=ranchers`);
  expect(duplicate?.status()).toBe(404);
});

test("V2 accepts authenticated variation/package conversion context, with idempotency", async ({ request }) => {
  const secret = process.env.CONVERSION_INGEST_SECRET;
  expect(secret).toBeTruthy();
  const properties = {
    testTraffic: true,
    variationId: "00000000-0000-4000-8000-000000000025",
    variationVersionId: "00000000-0000-4000-8000-000000000026",
    packageId: "00000000-0000-4000-8000-000000000024",
    packageCode: "1"
  };
  const occurredAt = new Date().toISOString();
  const analytics = {
    eventId: "v2-variation-attribution-event-001",
    eventName: "landing_view",
    occurredAt,
    ...ids,
    variantId: null,
    sessionId: "v2-variation-session-001",
    anonymousId: "v2-variation-anon-001",
    source: "meta",
    medium: "paid_social",
    properties
  };
  const acceptedEvent = await request.post("http://skillup.localhost:3000/api/events", { data: analytics });
  expect([200, 201]).toContain(acceptedEvent.status());
  expect(await acceptedEvent.json()).toMatchObject({ accepted: true });

  const success = {
    idempotencyKey: "v2-conversion-context-0001",
    eventName: "subscription_started",
    occurredAt,
    ...ids,
    variantId: null,
    sessionId: analytics.sessionId,
    value: 566,
    currency: "PKR",
    attribution: {
      firstTouch: { source: "meta", medium: "paid_social", campaign: "ranchers", capturedAt: occurredAt },
      lastTouch: { source: "meta", medium: "paid_social", campaign: "ranchers", capturedAt: occurredAt }
    },
    properties
  };
  const headers = { authorization: `Bearer ${secret}` };
  const one = await request.post("http://skillup.localhost:3000/api/conversions", { data: success, headers });
  expect([200, 201]).toContain(one.status());
  expect(await one.json()).toMatchObject({ accepted: true });
  const duplicate = await request.post("http://skillup.localhost:3000/api/conversions", { data: success, headers });
  expect(duplicate.status()).toBe(200);
  expect(await duplicate.json()).toMatchObject({ accepted: true, duplicate: true });

  // A foreign product or fake package must never attribute revenue to SkillUp.
  const spoofed = await request.post("http://skillup.localhost:3000/api/conversions", {
    data: {
      ...success, idempotencyKey: "v2-conversion-invalid-package-001",
      properties: { ...properties, packageId: "00000000-0000-4000-8000-000000000150" }
    }, headers
  });
  expect(spoofed.status()).toBe(400);
  expect(await spoofed.json()).toMatchObject({ error: "INVALID_CONTEXT" });

  const unrelatedBrand = await request.post("http://skillup.localhost:3000/api/conversions", {
    data: {
      ...success, idempotencyKey: "v2-conversion-cross-brand-001",
      brandId: "00000000-0000-4000-8000-000000000110"
    }, headers
  });
  expect(unrelatedBrand.status()).toBe(400);

  const publicSuccess = await request.post("http://skillup.localhost:3000/api/events", {
    data: { ...analytics, eventId: "v2-untrusted-success-event-001", eventName: "purchase" }
  });
  expect(publicSuccess.status()).toBe(403);
  expect(await publicSuccess.json()).toMatchObject({ error: "SUCCESS_REQUIRES_SERVER_CONFIRMATION" });
});

test("V2 consent-confirmed backend callback creates exactly one pending, unsent provider delivery", async ({ request }) => {
  // This test manipulates only disposable CI fixtures. Never point it at the live DB.
  test.skip(!process.env.DATABASE_URL?.includes("localhost:5432/growthos"), "Disposable CI database required");
  const secret = process.env.CONVERSION_INGEST_SECRET;
  expect(secret).toBeTruthy();
  const { client } = getDatabase();
  const brandId = "00000000-0000-4000-8000-000000000010";
  const packageId = "00000000-0000-4000-8000-000000000024";
  const variationId = "00000000-0000-4000-8000-000000000025";
  const variationVersionId = "00000000-0000-4000-8000-000000000026";
  const occurredAt = new Date().toISOString();
  try {
    await client`INSERT INTO integrations (brand_id, provider, status, public_config)
      VALUES (${brandId}, 'meta', 'enabled', '{"pixelId":"123456789012"}'::jsonb)
      ON CONFLICT (brand_id, provider) DO UPDATE SET status='enabled'`;
    await client`INSERT INTO conversion_event_rules
      (brand_id, package_id, provider, canonical_event, provider_event, status)
      VALUES (${brandId}, ${packageId}, 'meta', 'subscription_started', 'Subscribe', 'enabled')
      ON CONFLICT (brand_id, package_id, provider, canonical_event)
      DO UPDATE SET status='enabled', provider_event='Subscribe'`;
  } finally { await client.end(); }

  const consented = {
    idempotencyKey: "growthos-v2-consent-outbox-test-0001",
    eventName: "subscription_started",
    occurredAt,
    brandId, campaignId: "00000000-0000-4000-8000-000000000030",
    pageId: "00000000-0000-4000-8000-000000000050",
    versionId: "00000000-0000-4000-8000-000000000051",
    variantId: null, sessionId: "growthos-v2-outbox-session-01",
    value: 566, currency: "PKR",
    attribution: {
      firstTouch: { source: "meta", medium: "paid_social", campaign: "ranchers", capturedAt: occurredAt },
      lastTouch: { source: "meta", medium: "paid_social", campaign: "ranchers", capturedAt: occurredAt }
    },
    properties: {
      variationId, variationVersionId, packageId, packageCode: "1",
      marketingConsent: true, testTraffic: false,
      providerMatching: {
        externalIdSha256: "a".repeat(64),
        clientUserAgent: "Mozilla/5.0 GrowOS E2E Testing Browser",
        fbp: "fb.1.123.456",
        email: "not-a-queue-field@example.com"
      }
    }
  };
  const headers = { authorization: `Bearer ${secret}` };
  const first = await request.post("http://skillup.localhost:3000/api/conversions", { data: consented, headers });
  expect([200, 201]).toContain(first.status());
  const duplicate = await request.post("http://skillup.localhost:3000/api/conversions", { data: consented, headers });
  expect(duplicate.status()).toBe(200);
  expect(await duplicate.json()).toMatchObject({ accepted: true, duplicate: true });

  const db = getDatabase();
  try {
    const result = await db.client<{ provider: string; provider_event: string; status: string; attempt_count: number; total: number }[]>`
      SELECT d.provider, d.provider_event, d.status, d.attempt_count,
             count(*) over()::int AS total
      FROM conversion_provider_deliveries d
      JOIN conversions c ON c.id = d.conversion_id
      WHERE c.idempotency_key = ${consented.idempotencyKey}`;
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ provider: "meta", provider_event: "Subscribe", status: "pending", attempt_count: 0, total: 1 });
    const [matching] = await db.client<{ payload: Record<string, unknown>; properties: Record<string, unknown> }[]>`
      SELECT d.payload, c.properties
      FROM conversion_provider_deliveries d JOIN conversions c ON c.id = d.conversion_id
      WHERE c.idempotency_key = ${consented.idempotencyKey}`;
    expect((matching.payload.matching as Record<string, unknown>).externalIdSha256).toBe("a".repeat(64));
    expect(JSON.stringify(matching.payload)).not.toContain("not-a-queue-field@example.com");
    expect(matching.properties.providerMatching).toBeUndefined();
  } finally { await db.client.end(); }

  const noConsent = await request.post("http://skillup.localhost:3000/api/conversions", {
    data: {
      ...consented, idempotencyKey: "growthos-v2-no-consent-outbox-test-0001",
      properties: { ...consented.properties, marketingConsent: false }
    }, headers
  });
  expect([200, 201]).toContain(noConsent.status());
  const noConsentDb = getDatabase();
  try {
    const rows = await noConsentDb.client<{ count: number }[]>`
      SELECT count(d.id)::int AS count FROM conversion_provider_deliveries d
      JOIN conversions c ON c.id = d.conversion_id
      WHERE c.idempotency_key = 'growthos-v2-no-consent-outbox-test-0001'`;
    expect(rows[0]?.count).toBe(0);
  } finally { await noConsentDb.client.end(); }
});

test("provider delivery endpoint is not publicly callable", async ({ request }) => {
  const unauthorized = await request.post("http://skillup.localhost:3000/api/internal/dispatch-conversions", {
    data: {}
  });
  expect(unauthorized.status()).toBe(401);
  expect(await unauthorized.json()).toMatchObject({ error: "UNAUTHORIZED" });
});
