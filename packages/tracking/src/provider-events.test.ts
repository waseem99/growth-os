import { describe, expect, it } from "vitest";
import { canonicalProviderEvent, CONVERSION_PROVIDER_EVENTS } from "./provider-events";

describe("product conversion provider event mapping", () => {
  it("uses the requested Meta Subscribe/Purchase events", () => {
    expect(canonicalProviderEvent("meta", "subscription_started")).toBe("Subscribe");
    expect(canonicalProviderEvent("meta", "purchase")).toBe("Purchase");
  });
  it("uses TikTok standard web CompletePayment rather than guessing Meta names", () => {
    expect(canonicalProviderEvent("tiktok", "purchase")).toBe("CompletePayment");
    expect(canonicalProviderEvent("tiktok", "subscription_started")).toBe("Subscribe");
  });
  it("maps confirmed signup independently on both providers", () => {
    expect(canonicalProviderEvent("tiktok", "signup_complete")).toBe("CompleteRegistration");
    expect(canonicalProviderEvent("meta", "signup_complete")).toBe("CompleteRegistration");
  });
  it("contains only backend-confirmed success events", () => {
    expect(Object.keys(CONVERSION_PROVIDER_EVENTS.meta).sort()).toEqual(
      ["purchase", "signup_complete", "subscription_started"].sort()
    );
  });
});
