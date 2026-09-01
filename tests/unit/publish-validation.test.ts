import { describe, expect, it } from "vitest";
import { defaultPageSeo, skillupCleanReference } from "@growth-os/page-engine";
import { validatePublishInput } from "../../apps/admin/lib/publish-validation";

describe("publication validation", () => {
  it("accepts a valid page and SEO snapshot", () => {
    const result = validatePublishInput({ document: skillupCleanReference, seo: defaultPageSeo("SkillUp Premium"), domainRequired: false, domainVerified: true });
    expect(result.ok).toBe(true);
  });

  it("blocks invalid domains, assets and SEO before pointer changes", () => {
    const result = validatePublishInput({ document: skillupCleanReference, seo: { title: "x", description: "short" }, domainRequired: true, domainVerified: false, invalidAssetIds: ["11111111-1111-4111-8111-111111111111"] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings.some((finding) => finding.path === "domain")).toBe(true);
      expect(result.findings.some((finding) => finding.path === "assets")).toBe(true);
      expect(result.findings.some((finding) => finding.path.startsWith("seo."))).toBe(true);
    }
  });
});
