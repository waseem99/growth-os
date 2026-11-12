import { describe, expect, it } from "vitest";
import {
  conversionTokenMatchesBrand, earlyConversionTokenAccepted, hasConversionSecretConfig
} from "./conversion-auth";

const skillupId = "00000000-0000-4000-8000-000000000010";
const jalwaId = "00000000-0000-4000-8000-000000000110";
const env = {
  CONVERSION_INGEST_SECRET: "legacy-global-test-secret",
  GROWTHOS_CONVERSION_SECRET_00000000000040008000000000000010: "skillup-product-test-secret",
  GROWTHOS_CONVERSION_SECRET_00000000000040008000000000000110: "jalwa-product-test-secret"
};

describe("per-product server conversion authentication", () => {
  it("requires configured credentials", () => {
    expect(hasConversionSecretConfig({})).toBe(false);
    expect(hasConversionSecretConfig(env)).toBe(true);
  });
  it("accepts a known product token early without trusting its declared brand", () => {
    expect(earlyConversionTokenAccepted("skillup-product-test-secret", env)).toBe(true);
    expect(earlyConversionTokenAccepted("unrecognized", env)).toBe(false);
  });
  it("refuses global fallback for brands with a scoped credential", () => {
    expect(conversionTokenMatchesBrand("legacy-global-test-secret", skillupId, env)).toBe(false);
    expect(conversionTokenMatchesBrand("skillup-product-test-secret", skillupId, env)).toBe(true);
  });
  it("refuses one product token for another product", () => {
    expect(conversionTokenMatchesBrand("skillup-product-test-secret", jalwaId, env)).toBe(false);
    expect(conversionTokenMatchesBrand("jalwa-product-test-secret", jalwaId, env)).toBe(true);
  });
  it("supports existing products until their product-specific secret is provisioned", () => {
    expect(conversionTokenMatchesBrand("legacy-global-test-secret", skillupId, {
      CONVERSION_INGEST_SECRET: "legacy-global-test-secret"
    })).toBe(true);
  });
  it("rejects malformed product IDs and empty tokens", () => {
    expect(conversionTokenMatchesBrand("x", "../brand", env)).toBe(false);
    expect(conversionTokenMatchesBrand("", skillupId, env)).toBe(false);
  });
});
