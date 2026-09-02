import { expect, test } from "@playwright/test";

test("health endpoints are ready and return security/request headers", async ({ request }) => {
  for (const url of ["http://127.0.0.1:3000/api/health", "http://127.0.0.1:3001/api/health"]) {
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(response.headers()["x-request-id"]).toBeTruthy();
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(await response.json()).toMatchObject({ status: "ready" });
  }
});

test("admin has no public signup and requires authentication", async ({ page }) => {
  await page.goto("http://127.0.0.1:3001/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to continue.");
  await expect(page.getByText(/no public account registration/i)).toBeVisible();
});

test("public ingestion rejects malformed and unauthenticated writes safely", async ({ request }) => {
  for (const origin of ["http://127.0.0.1:3000", "http://127.0.0.1:3001"]) {
    const invalidEvent = await request.post(`${origin}/api/events`, { data: { bad: true } });
    expect(invalidEvent.status()).toBe(400);
    expect(invalidEvent.headers()["x-request-id"]).toBeTruthy();
    expect(invalidEvent.headers()["x-ratelimit-limit"]).toBe("120");

    const conversion = await request.post(`${origin}/api/conversions`, { data: { bad: true } });
    expect(conversion.status()).toBe(401);
    expect(conversion.headers()["x-request-id"]).toBeTruthy();
  }
});
