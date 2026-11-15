import { expect, test } from "@playwright/test";
import { getDatabase } from "@growth-os/db";

const admin = "http://127.0.0.1:3001";
const web = "http://skillup.localhost:3000";
const fixture = {
  brandId: "00000000-0000-4000-8000-000000000010",
  campaignId: "00000000-0000-4000-8000-000000000030",
  pageId: "00000000-0000-4000-8000-000000000050",
  versionId: "00000000-0000-4000-8000-000000000051",
  variationId: "00000000-0000-4000-8000-000000000025",
  variationVersionId: "00000000-0000-4000-8000-000000000026",
  packageId: "00000000-0000-4000-8000-000000000024",
  packageCode: "1",
};

test("variation reporting excludes QA events and shows confirmed conversion without a browser view", async ({ page, request }) => {
  test.skip(!process.env.DATABASE_URL?.includes("localhost:5432/growthos") ||
    !process.env.INTERNAL_ADMIN_EMAIL || !process.env.INTERNAL_ADMIN_PASSWORD,
  "Requires disposable, synthetic CI PostgreSQL and Owner credentials");

  const suffix = Date.now().toString(36);
  const occurredAt = new Date().toISOString();
  const source = "tiktok";
  const session = `reconcile-synthetic-${suffix}`;
  const event = await request.post(`${web}/api/events`, {
    data: {
      eventId: `reconcile-test-view-${suffix}`,
      eventName: "landing_view",
      occurredAt,
      ...fixture,
      variantId: null,
      sessionId: session,
      anonymousId: `reconcile-anon-${suffix}`,
      source,
      medium: "paid_social",
      properties: { testTraffic: true, variationId: fixture.variationId, packageCode: fixture.packageCode },
    },
  });
  expect([200, 201]).toContain(event.status());

  const touch = { source, medium: "paid_social", campaign: "qa-campaign",
    capturedAt: occurredAt };
  const payload = {
    idempotencyKey: `reconcile-confirmed-${suffix}`,
    eventName: "subscription_started",
    occurredAt,
    ...fixture,
    variantId: null,
    sessionId: session,
    value: 566,
    currency: "PKR",
    attribution: { firstTouch: touch, lastTouch: touch },
    properties: {
      variationId: fixture.variationId,
      variationVersionId: fixture.variationVersionId,
      packageId: fixture.packageId,
      packageCode: fixture.packageCode,
      syntheticCiFixture: true,
      testTraffic: false, // Deliberately reportable in this *disposable* DB only.
      marketingConsent: false,
    },
  };
  const success = await request.post(`${web}/api/conversions`, {
    headers: { authorization: `Bearer ${process.env.CONVERSION_INGEST_SECRET}` },
    data: payload,
  });
  expect([200, 201]).toContain(success.status());
  const duplicate = await request.post(`${web}/api/conversions`, {
    headers: { authorization: `Bearer ${process.env.CONVERSION_INGEST_SECRET}` },
    data: payload,
  });
  expect(duplicate.status()).toBe(200);
  expect(await duplicate.json()).toMatchObject({ accepted: true, duplicate: true });

  await page.goto(`${admin}/login`);
  await page.locator('input[name="email"]').fill(process.env.INTERNAL_ADMIN_EMAIL!);
  await page.locator('input[name="password"]').fill(process.env.INTERNAL_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(admin + "/", { timeout: 25_000 });

  await page.goto(`${admin}/analytics/variations`);
  await expect(page.getByRole("heading", { name: "Variations · last 30 days" })).toBeVisible();
  const row = page.locator("tbody tr").filter({ hasText: "ranchers" }).filter({ hasText: "tiktok" });
  await expect(row).toHaveCount(1);
  const cells = await row.locator("td").allTextContents();
  expect(cells[2]).toContain("1");
  expect(cells[3]).toContain("tiktok");
  expect(Number(cells[4]?.trim())).toBe(0); // synthetic page visit excluded
  expect(Number(cells[5]?.trim())).toBe(0);
  expect(Number(cells[6]?.trim())).toBe(0);
  expect(Number(cells[7]?.trim())).toBe(1); // conversion-only row included

  await page.goto(`${admin}/analytics`);
  await expect(page.locator("body")).toContainText(/subscription|converting|revenue/i);

  const { client } = getDatabase();
  try {
    const [confirmed] = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM conversions WHERE idempotency_key=${payload.idempotencyKey}`;
    expect(confirmed.count).toBe(1);
    const [synthetic] = await client<{ views: number }[]>`
      SELECT count(*)::int AS views FROM analytics_events
      WHERE event_id=${`reconcile-test-view-${suffix}`} AND properties->>'testTraffic'='true'`;
    expect(synthetic.views).toBe(1);
    const [queue] = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM conversion_provider_deliveries
      WHERE conversion_id IN (SELECT id FROM conversions WHERE idempotency_key=${payload.idempotencyKey})`;
    expect(queue.count).toBe(0);
  } finally {
    await client.end();
  }
  await test.info().attach("conversion-only-variation-analytics", {
    body: await page.screenshot({ fullPage: true }), contentType: "image/png",
  });
});
