import { describe, expect, it } from "vitest";
import { deliveryPayload, deliveryProvider, sanitizeProviderMatch } from "./conversion-delivery";

describe("trusted provider conversion delivery", () => {
  it("requires affirmative backend consent before queueing", () => {
    expect(deliveryProvider({ source: "meta", marketingConsent: undefined, testTraffic: false })).toBeNull();
    expect(deliveryProvider({ source: "meta", marketingConsent: "true", testTraffic: false })).toBeNull();
    expect(deliveryProvider({ source: "meta", marketingConsent: false, testTraffic: false })).toBeNull();
    expect(deliveryProvider({ source: "meta", marketingConsent: true, testTraffic: false })).toBe("meta");
  });
  it("never queues test traffic or unknown sources", () => {
    expect(deliveryProvider({ source: "meta", marketingConsent: true, testTraffic: true })).toBeNull();
    expect(deliveryProvider({ source: "google", marketingConsent: true, testTraffic: false })).toBeNull();
  });
  it("normalizes verified Meta and TikTok traffic consistently", () => {
    expect(deliveryProvider({ source: "Instagram", marketingConsent: true, testTraffic: false })).toBe("meta");
    expect(deliveryProvider({ source: "TikTok", marketingConsent: true, testTraffic: false })).toBe("tiktok");
  });
  it("creates stable non-PII event IDs for the same canonical conversion", () => {
    const payload = deliveryPayload({
      conversionId: "00000000-0000-4000-8000-000000000123",
      providerEvent: "Subscribe", occurredAt: "2026-11-12T00:00:00.000Z",
      value: 566, currency: "PKR",
      pageId: "00000000-0000-4000-8000-000000000050",
      variationId: "00000000-0000-4000-8000-000000000025",
      packageCode: "1"
    });
    expect(payload.event_id).toBe("growthos_00000000-0000-4000-8000-000000000123");
    expect(JSON.stringify(payload)).not.toContain("email");
    expect(JSON.stringify(payload)).not.toContain("phone");
  });
  it("accepts only hashed IDs and bounded matching signals", () => {
    const matched = sanitizeProviderMatch({
      externalIdSha256: "A".repeat(64), clientUserAgent: "Mozilla/5.0 browser",
      fbp: "fb.1.123.456", email: "sensitive@example.com"
    });
    expect(matched).toMatchObject({ externalIdSha256: "a".repeat(64), fbp: "fb.1.123.456" });
    expect(JSON.stringify(matched)).not.toContain("sensitive@example.com");
  });
  it("rejects raw identifiers and malformed matching context", () => {
    expect(sanitizeProviderMatch({ externalIdSha256: "customer-001", clientUserAgent: "Mozilla/5.0" })).toBeNull();
    expect(sanitizeProviderMatch({ externalIdSha256: "a".repeat(64), clientUserAgent: "bad\\nagent" })).toBeNull();
    expect(sanitizeProviderMatch(undefined)).toBeNull();
  });
});
