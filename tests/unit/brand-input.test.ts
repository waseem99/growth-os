import { describe, expect, it } from "vitest";
import { normalizeHostname, normalizeSlug } from "../../apps/admin/lib/brand-input";
import { normalizeRequestHost } from "../../apps/web/lib/brand-resolution";

describe("brand/domain normalization", () => {
  it("normalizes safe identifiers", () => {
    expect(normalizeSlug("Skill-Up")).toBe("skill-up");
    expect(normalizeHostname("GO.SkillUp.PK.")).toBe("go.skillup.pk");
    expect(normalizeRequestHost("SkillUp.Localhost:3000")).toBe("skillup.localhost");
  });
  it("rejects URLs and malformed hosts", () => {
    expect(() => normalizeHostname("https://go.skillup.pk/path")).toThrow("INVALID_HOSTNAME");
    expect(() => normalizeSlug("Skill Up")).toThrow("INVALID_SLUG");
  });
});
