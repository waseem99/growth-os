import { describe, expect, it } from "vitest";
import { analyticsEventInputSchema, conversionInputSchema } from "./schema";

const ids = {
  brandId: "00000000-0000-4000-8000-000000000010",
  campaignId: "00000000-0000-4000-8000-000000000030",
  pageId: "00000000-0000-4000-8000-000000000050",
  versionId: "00000000-0000-4000-8000-000000000051"
};

describe("tracking contracts", () => {
  it("accepts a contextualized landing event", () => {
    const parsed = analyticsEventInputSchema.safeParse({
      eventId: "event-0001",
      eventName: "landing_view",
      occurredAt: "2026-09-01T12:00:00.000Z",
      ...ids,
      sessionId: "session-0001",
      anonymousId: "anonymous-0001",
      properties: {}
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported event names and malformed IDs", () => {
    expect(analyticsEventInputSchema.safeParse({ eventId: "event-0002", eventName: "password_captured", occurredAt: "2026-09-01T12:00:00.000Z", ...ids, brandId: "bad", sessionId: "session-0002", anonymousId: "anonymous-0002" }).success).toBe(false);
  });

  it("requires an idempotency key and immutable page version for conversions", () => {
    const parsed = conversionInputSchema.safeParse({
      idempotencyKey: "order-12345678",
      eventName: "subscription_started",
      occurredAt: "2026-09-01T12:10:00.000Z",
      ...ids,
      value: 599,
      currency: "PKR",
      attribution: { firstTouch: null, lastTouch: null },
      properties: {}
    });
    expect(parsed.success).toBe(true);
    expect(conversionInputSchema.safeParse({ idempotencyKey: "short", eventName: "subscription_started", occurredAt: "2026-09-01T12:10:00.000Z", brandId: ids.brandId, pageId: ids.pageId }).success).toBe(false);
  });
});
