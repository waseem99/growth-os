import { describe, expect, it } from "vitest";
import { canonicalConversionGoal, defaultConversionGoalForTemplate } from "../../apps/admin/lib/page-input";

describe("landing-page conversion goals", () => {
  it("accepts canonical conversion-ingestion outcomes", () => {
    expect(canonicalConversionGoal("signup_complete")).toBe("signup_complete");
    expect(canonicalConversionGoal("purchase")).toBe("purchase");
    expect(canonicalConversionGoal("subscription_started")).toBe("subscription_started");
  });

  it("normalizes supported legacy goal names", () => {
    expect(canonicalConversionGoal("seller_registration")).toBe("signup_complete");
    expect(canonicalConversionGoal("subscription")).toBe("subscription_started");
    expect(canonicalConversionGoal("untracked_custom_goal")).toBeNull();
  });

  it("chooses canonical defaults for page templates", () => {
    expect(defaultConversionGoalForTemplate("subscription-acquisition")).toBe("subscription_started");
    expect(defaultConversionGoalForTemplate("content-acquisition")).toBe("signup_complete");
    expect(defaultConversionGoalForTemplate("game-acquisition")).toBe("signup_complete");
    expect(defaultConversionGoalForTemplate("minimal")).toBe("signup_complete");
  });
});
