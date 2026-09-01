import { describe, expect, it } from "vitest";
import { deriveMetrics, percentageChange } from "./index";

describe("analytics metrics", () => {
  it("uses landing views for CTA rate and unique landing sessions for subscription conversion", () => {
    const metrics = deriveMetrics({ landingViews: 200, uniqueSessions: 100, ctaClicks: 50, signupStarts: 20, signupCompletes: 10, checkoutStarts: 8, purchases: 4, subscriptions: 5, revenue: 2500 });
    expect(metrics.ctaRate).toBe(0.25);
    expect(metrics.subscriptionConversionRate).toBe(0.05);
    expect(metrics.revenuePerVisitor).toBe(25);
  });

  it("returns zero instead of NaN for empty periods", () => {
    const metrics = deriveMetrics({ landingViews: 0, uniqueSessions: 0, ctaClicks: 0, signupStarts: 0, signupCompletes: 0, checkoutStarts: 0, purchases: 0, subscriptions: 0, revenue: 0 });
    expect(metrics.ctaRate).toBe(0);
    expect(metrics.subscriptionConversionRate).toBe(0);
    expect(metrics.revenuePerVisitor).toBe(0);
  });

  it("marks growth from a zero baseline as not-comparable", () => {
    expect(percentageChange(10, 0)).toBeNull();
    expect(percentageChange(0, 0)).toBe(0);
    expect(percentageChange(120, 100)).toBeCloseTo(0.2);
  });
});
