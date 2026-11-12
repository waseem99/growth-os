import { describe, expect, it } from "vitest";
import { approvedCheckoutDestination } from "./checkout-destination";

describe("approved per-product checkout handoff", () => {
  it("uses only administrator-configured HTTPS destinations", () => {
    const result = approvedCheckoutDestination({ subscriptionUrl: "https://checkout.skillup.example/start" }, "package-uuid", "1");
    expect(result).toContain("checkout.skillup.example/start");
    expect(result).toContain("growthos_package_code=1");
    expect(result).toContain("growthos_package_id=package-uuid");
  });
  it("does not invent a destination for an unconfigured product", () => {
    expect(approvedCheckoutDestination({}, "id", "1")).toBeNull();
  });
  it.each(["javascript:alert(1)", "http://example.com/", "https://user:pass@example.com/", "https://localhost/pay", "https://checkout.example.com/#fragment"])(
    "rejects invalid/unapproved destination %s", (url) => {
      expect(approvedCheckoutDestination({ subscriptionUrl: url }, null, "1")).toBeNull();
    }
  );
  it("does not change the product destination based on query package", () => {
    const result = approvedCheckoutDestination({ subscriptionUrl: "https://checkout.jalwa.example/pay" }, null, "../different-product");
    expect(new URL(result!).hostname).toBe("checkout.jalwa.example");
    expect(new URL(result!).searchParams.get("growthos_package_code")).toBe("../different-product");
  });
}
