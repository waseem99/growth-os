export type BrandTheme = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  fontFamily: string;
  radius: string;
};

export type BrandDefaults = {
  locale: string;
  termsUrl: string;
  privacyUrl: string;
  defaultCtaLabel: string;
  defaultConversionGoal: string;
  defaultSeoTitle: string;
  subscriptionUrl: string;
};

const hex = /^#[0-9a-f]{6}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hostname = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeSlug(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!slug.test(normalized)) throw new Error("INVALID_SLUG");
  return normalized;
}

export function normalizeHostname(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.includes("://") || normalized.includes("/") || normalized.includes(":")) throw new Error("INVALID_HOSTNAME");
  if (!hostname.test(normalized)) throw new Error("INVALID_HOSTNAME");
  return normalized;
}

function urlOrEmpty(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("INVALID_URL");
  return parsed.toString();
}

export function parseTheme(formData: FormData): BrandTheme {
  const primary = String(formData.get("primary") ?? "#6236ff").trim();
  const secondary = String(formData.get("secondary") ?? "#17131f").trim();
  const background = String(formData.get("background") ?? "#ffffff").trim();
  const text = String(formData.get("text") ?? "#15111f").trim();
  for (const color of [primary, secondary, background, text]) {
    if (!hex.test(color)) throw new Error("INVALID_COLOR");
  }
  const radius = String(formData.get("radius") ?? "16px").trim();
  if (!/^\d{1,2}px$/.test(radius)) throw new Error("INVALID_RADIUS");
  const fontFamily = String(formData.get("fontFamily") ?? "Inter, system-ui, sans-serif").trim().slice(0, 160);
  if (!fontFamily) throw new Error("INVALID_FONT");
  return { primary, secondary, background, text, fontFamily, radius };
}

export function parseDefaults(formData: FormData): BrandDefaults {
  return {
    locale: String(formData.get("locale") ?? "en-PK").trim().slice(0, 20) || "en-PK",
    termsUrl: urlOrEmpty(String(formData.get("termsUrl") ?? "")),
    privacyUrl: urlOrEmpty(String(formData.get("privacyUrl") ?? "")),
    defaultCtaLabel: String(formData.get("defaultCtaLabel") ?? "Get started").trim().slice(0, 80) || "Get started",
    defaultConversionGoal: String(formData.get("defaultConversionGoal") ?? "subscription_started").trim().slice(0, 80),
    defaultSeoTitle: String(formData.get("defaultSeoTitle") ?? "").trim().slice(0, 120),
    subscriptionUrl: urlOrEmpty(String(formData.get("subscriptionUrl") ?? ""))
  };
}
