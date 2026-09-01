import { describe, expect, it } from "vitest";
import { canManageRole, hasPermission } from "../../apps/admin/lib/authz";

describe("GrowthOS RBAC", () => {
  it("limits analyst and editor privileges", () => {
    expect(hasPermission("analyst", "analytics:view")).toBe(true);
    expect(hasPermission("analyst", "pages:manage")).toBe(false);
    expect(hasPermission("editor", "pages:manage")).toBe(true);
    expect(hasPermission("editor", "users:manage")).toBe(false);
    expect(hasPermission("editor", "integrations:manage")).toBe(false);
  });

  it("prevents admins from assigning or modifying owners", () => {
    expect(canManageRole("admin", "owner")).toBe(false);
    expect(canManageRole("admin", "editor")).toBe(true);
    expect(canManageRole("owner", "owner")).toBe(true);
  });
});
