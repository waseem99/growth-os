import { describe, expect, it } from "vitest";
import { buildProviderTransport, providerAccepted } from "./provider-transport";

const hash = "a".repeat(64);
const matching = { externalIdSha256: hash, clientUserAgent: "Mozilla/5.0 TestBrowser", fbp: "fb.1.123.456", ttclid: "ttclid-test" };
const event = {
  event_id: "growthos_00000000-0000-4000-8000-000000000001",
  event: "Subscribe",
  occurred_at: new Date().toISOString(),
  value: 566,
  currency: "PKR",
  matching
};
const shared = { token: "secret-provider-test-token", pageUrl: "https://skillup.example/landing?tracking=discarded", event };

describe("consent-based provider request builder", () => {
  it("builds valid Meta CAPI website events without PII in the URL", () => {
    const req = buildProviderTransport({ provider: "meta", pixelId: "1234567890123", ...shared });
    expect(req?.endpoint).toBe("https://graph.facebook.com/v25.0/1234567890123/events");
    expect(req?.headers.authorization).toBe("Bearer secret-provider-test-token");
    expect((req?.body.data as Record<string, unknown>[])[0]).toMatchObject({
      event_name: "Subscribe", event_id: event.event_id,
      event_source_url: "https://skillup.example/landing", action_source: "website",
      user_data: { external_id: [hash], client_user_agent: "Mozilla/5.0 TestBrowser" },
      custom_data: { value: 566, currency: "PKR" }
    });
    expect(JSON.stringify(req?.body)).not.toContain("tracking=discarded");
  });
  it("uses TikTok Events API 2.0 /event/track with deduplicable event ID", () => {
    const req = buildProviderTransport({ provider: "tiktok", pixelId: "C1TIKTOKPIXEL", ...shared, event: { ...event, event: "CompletePayment" } });
    expect(req?.endpoint).toBe("https://business-api.tiktok.com/open_api/v1.3/event/track/");
    expect(req?.body).toMatchObject({
      event_source: "web",
      event_source_id: "C1TIKTOKPIXEL",
      data: [{ event: "CompletePayment", event_id: event.event_id, user: { external_id: hash }, page: { url: "https://skillup.example/landing" } }]
    });
  });
  it("does not create sendable events without consent-derived matching", () => {
    expect(buildProviderTransport({ provider: "meta", pixelId: "1234567890123", ...shared, event: { ...event, matching: undefined } })).toBeNull();
  });
  it.each(["http://example.org/", "javascript:alert(1)", "https://user:pass@example.org/"])(
    "blocks unsafe event URLs %s", pageUrl => {
      expect(buildProviderTransport({ provider: "meta", pixelId: "1234567890123", ...shared, pageUrl })).toBeNull();
    }
  );
  it("rejects stale events and bogus pixel IDs", () => {
    const old = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString();
    expect(buildProviderTransport({ provider: "meta", pixelId: "1234567890123", ...shared, event: { ...event, occurred_at: old } })).toBeNull();
    expect(buildProviderTransport({ provider: "meta", pixelId: "wrong", ...shared })).toBeNull();
  });
  it("checks the provider response body rather than only HTTP success", () => {
    expect(providerAccepted("meta", 200, { events_received: 1 })).toBe(true);
    expect(providerAccepted("meta", 200, { events_received: 0 })).toBe(false);
    expect(providerAccepted("tiktok", 200, { code: 0 })).toBe(true);
    expect(providerAccepted("tiktok", 200, { code: 40002 })).toBe(false);
    expect(providerAccepted("meta", 500, { events_received: 1 })).toBe(false);
  });
});
