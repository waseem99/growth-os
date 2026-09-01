import { describe, expect, it } from "vitest";
import { canonicalFor, publicOrigin, shouldListInSitemap } from "./public-seo";
import type { PageSeo } from "@growth-os/page-engine";

const seo = (overrides: Partial<PageSeo> = {}): PageSeo => ({
  title: "Campaign title",
  description: "A sufficiently useful campaign description for search and social previews.",
  canonicalUrl: null,
  index: true,
  socialTitle: "",
  socialDescription: "",
  socialAssetId: null,
  structuredData: {},
  ...overrides
});

describe("public SEO helpers", () => {
  it("uses https for production hosts and http for localhost", () => {
    expect(publicOrigin("Go.Example.com")).toBe("https://go.example.com");
    expect(publicOrigin("skillup.localhost")).toBe("http://skillup.localhost");
  });

  it("builds a deterministic canonical URL from host and slug", () => {
    expect(canonicalFor(seo(), "go.example.com", "/offer")).toBe("https://go.example.com/offer");
  });

  it("honors an explicit canonical override", () => {
    expect(canonicalFor(seo({ canonicalUrl: "https://www.example.com/offer" }), "go.example.com", "offer")).toBe("https://www.example.com/offer");
  });

  it("only lists indexable pages in sitemap", () => {
    expect(shouldListInSitemap(seo())).toBe(true);
    expect(shouldListInSitemap(seo({ index: false }))).toBe(false);
  });
});
