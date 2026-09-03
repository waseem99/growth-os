import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "packages/page-engine/src/bizb-single-screen.css"), "utf8");

describe("BizB acquisition viewport contract", () => {
  it("keeps the acquisition preset scoped and locked to one viewport", () => {
    expect(css).toContain(".go-preset--bizb-marketplace");
    expect(css).toContain("height: 100svh");
    expect(css).toContain("max-height: 100svh");
    expect(css).toContain("max-width: 100vw");
    expect(css).toContain("overflow: hidden");
  });

  it("suppresses long-form sections and duplicate sticky CTAs", () => {
    expect(css).toContain(".go-section:not(.go-cta)");
    expect(css).toContain(".go-footer");
    expect(css).toContain(".go-sticky");
    expect(css).toContain("display: none");
  });

  it("defines both portrait and landscape mobile layouts", () => {
    expect(css).toContain("orientation: portrait");
    expect(css).toContain("orientation: landscape");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
  });
});
