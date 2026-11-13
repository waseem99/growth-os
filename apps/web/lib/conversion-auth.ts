import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Existing global CONVERSION_INGEST_SECRET is kept for legacy products.
 * When a per-product secret is configured, it takes precedence and the global
 * credential cannot submit conversions for that product.
 *
 * Product secret key: GROWTHOS_CONVERSION_SECRET_<32_HEX_DIGIT_BRAND_UUID>
 * Keep all credentials in protected server env vars; never send them in URLs.
 */
const PER_PRODUCT_PREFIX = "GROWTHOS_CONVERSION_SECRET_";
const ENV_KEY = /^GROWTHOS_CONVERSION_SECRET_[A-F0-9]{32}$/;

function secureEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right) && a.length > 0 && b.length > 0;
}

export function hasConversionSecretConfig(env: Readonly<Record<string, string | undefined>>) {
  return Boolean(env.CONVERSION_INGEST_SECRET) ||
    Object.entries(env).some(([key, value]) => ENV_KEY.test(key) && Boolean(value));
}

export function earlyConversionTokenAccepted(token: string, env: Readonly<Record<string, string | undefined>>) {
  if (!token) return false;
  const allowed = [
    env.CONVERSION_INGEST_SECRET,
    ...Object.entries(env).filter(([key]) => ENV_KEY.test(key)).map(([, value]) => value)
  ].filter((value): value is string => Boolean(value));
  return allowed.some((secret) => secureEqual(token, secret));
}

export function conversionTokenMatchesBrand(token: string, brandId: string, env: Readonly<Record<string, string | undefined>>) {
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandId)) {
    return false;
  }
  const scopedKey = `${PER_PRODUCT_PREFIX}${brandId.replace(/-/g, "").toUpperCase()}`;
  const configured = env[scopedKey] || env.CONVERSION_INGEST_SECRET;
  return typeof configured === "string" && secureEqual(token, configured);
}
