import { describe, expect, it } from "vitest";
import { parseCampaignParameters } from "./campaign-parameters";

describe("GrowthOS V2 campaign parameters", () => {
  it("recognizes client legacy Meta URL", () => {
    expect(parseCampaignParameters(new URLSearchParams("utm=M&package=1&parameter=ranchers"))).toEqual({
      valid: true, source: "meta", packageCode: "1", variationKey: "ranchers"
    });
  });
  it("recognizes client TikTok shorthand", () => {
    expect(parseCampaignParameters(new URLSearchParams("utm=T&package=2&parameter=ranchers"))).toEqual({
      valid: true, source: "tiktok", packageCode: "2", variationKey: "ranchers"
    });
  });
  it("accepts canonical UTM source and normalizes aliases", () => {
    expect(parseCampaignParameters({ utm_source: "Facebook", parameter: "ranchers" })).toEqual({
      valid: true, source: "meta", packageCode: null, variationKey: "ranchers"
    });
  });
  it("allows future sources without inventing a provider integration", () => {
    expect(parseCampaignParameters({ utm_source: "google" })).toEqual({
      valid: true, source: "google", packageCode: null, variationKey: null
    });
  });
  it("rejects mismatched legacy and standard sources", () => {
    expect(parseCampaignParameters(new URLSearchParams("utm=M&utm_source=tiktok"))).toEqual({
      valid: false, reason: "conflicting_source"
    });
  });
  it("rejects duplicate parameter keys before resolution", () => {
    expect(parseCampaignParameters(new URLSearchParams("package=1&package=2"))).toEqual({
      valid: false, reason: "duplicate_parameter"
    });
  });
  it("rejects malformed variation slugs", () => {
    expect(parseCampaignParameters({ parameter: "../ranchers" })).toEqual({
      valid: false, reason: "invalid_variation"
    });
  });
  it("rejects malformed package codes", () => {
    expect(parseCampaignParameters({ package: "<script>" })).toEqual({
      valid: false, reason: "invalid_package"
    });
  });
  it("rejects invalid source identifiers", () => {
    expect(parseCampaignParameters({ utm_source: "meta/page" })).toEqual({
      valid: false, reason: "invalid_source"
    });
  });
  it("rejects unsupported legacy short values", () => {
    expect(parseCampaignParameters({ utm: "X" })).toEqual({
      valid: false, reason: "unsupported_legacy_utm"
    });
  });
  it("defaults all selections when no parameters are supplied", () => {
    expect(parseCampaignParameters({})).toEqual({
      valid: true, source: null, packageCode: null, variationKey: null
    });
  });
  it("rejects blank array duplicates rather than guessing", () => {
    expect(parseCampaignParameters({ parameter: ["ranchers", "ranchers"] })).toEqual({
      valid: false, reason: "duplicate_parameter"
    });
  });
});
