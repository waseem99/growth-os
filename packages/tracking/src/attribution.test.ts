import { describe, expect, it } from "vitest";
import { attributionTouchFromQuery, eventUtmFields, nextAttribution } from "./attribution";

describe("acquisition attribution", () => {
  it("creates a normalized touch from UTM query values", () => {
    const touch = attributionTouchFromQuery({ utm_source: " TikTok ", utm_medium: "paid_social", utm_campaign: "launch", utm_content: "creative-7" }, "2026-09-01T12:00:00.000Z");
    expect(touch).toMatchObject({ source: "TikTok", medium: "paid_social", campaign: "launch", content: "creative-7", creativeId: "creative-7" });
  });

  it("returns null when no marketing context is present", () => {
    expect(attributionTouchFromQuery({})).toBeNull();
  });

  it("preserves first touch and advances last touch", () => {
    const first = attributionTouchFromQuery({ utm_source: "tiktok", utm_campaign: "prospecting" }, "2026-09-01T10:00:00.000Z");
    const second = attributionTouchFromQuery({ utm_source: "instagram", utm_campaign: "retargeting" }, "2026-09-01T11:00:00.000Z");
    const initial = nextAttribution(null, first);
    const updated = nextAttribution(initial, second);
    expect(updated.firstTouch?.source).toBe("tiktok");
    expect(updated.lastTouch?.source).toBe("instagram");
    expect(eventUtmFields(updated).campaignName).toBe("retargeting");
  });
});
