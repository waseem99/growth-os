/**
 * Client-compatible campaign URL parsing. Pure and safe to use on public requests.
 * This module does not select pricing or fire conversion events.
 */
export type CampaignParameterError =
  | "duplicate_parameter"
  | "invalid_variation"
  | "invalid_package"
  | "invalid_source"
  | "unsupported_legacy_utm"
  | "conflicting_source";

export type ParsedCampaignParameters =
  | { valid: true; variationKey: string | null; packageCode: string | null; source: string | null }
  | { valid: false; reason: CampaignParameterError };

type Query = URLSearchParams | Record<string, string | string[] | undefined>;

function values(query: Query, key: string): string[] {
  if (query instanceof URLSearchParams) return query.getAll(key);
  const raw = query[key];
  return Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
}

function normalizeSource(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,64}$/.test(value)) return null;
  if (["m", "meta", "facebook", "fb", "instagram", "ig"].includes(value)) return "meta";
  if (["t", "tiktok", "tt"].includes(value)) return "tiktok";
  return value;
}

const VARIATION_KEY = /^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/;
const PACKAGE_CODE = /^[a-z0-9]([a-z0-9_-]{0,62}[a-z0-9])?$/;

export function parseCampaignParameters(query: Query): ParsedCampaignParameters {
  const supported = ["parameter", "package", "utm", "utm_source"];
  for (const key of supported) {
    if (values(query, key).length > 1) return { valid: false, reason: "duplicate_parameter" };
  }

  const parameterRaw = (values(query, "parameter")[0] ?? "").trim().toLowerCase();
  const packageRaw = (values(query, "package")[0] ?? "").trim().toLowerCase();
  if (parameterRaw && !VARIATION_KEY.test(parameterRaw)) return { valid: false, reason: "invalid_variation" };
  if (packageRaw && !PACKAGE_CODE.test(packageRaw)) return { valid: false, reason: "invalid_package" };

  const shorthandRaw = (values(query, "utm")[0] ?? "").trim();
  let shorthandSource: "meta" | "tiktok" | null = null;
  if (shorthandRaw) {
    if (shorthandRaw.toUpperCase() === "M") shorthandSource = "meta";
    else if (shorthandRaw.toUpperCase() === "T") shorthandSource = "tiktok";
    else return { valid: false, reason: "unsupported_legacy_utm" };
  }

  const sourceRaw = (values(query, "utm_source")[0] ?? "").trim();
  const explicitSource = sourceRaw ? normalizeSource(sourceRaw) : null;
  if (sourceRaw && !explicitSource) return { valid: false, reason: "invalid_source" };
  if (shorthandSource && explicitSource && shorthandSource !== explicitSource) {
    return { valid: false, reason: "conflicting_source" };
  }

  return {
    valid: true,
    variationKey: parameterRaw || null,
    packageCode: packageRaw || null,
    source: explicitSource || shorthandSource
  };
}
