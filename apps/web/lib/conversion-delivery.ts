/**
 * Provider delivery is conditional on a trusted product-backend consent
 * assertion. URL parameters or browser click events cannot establish it.
 */
export type DeliveryProvider = "meta" | "tiktok";

export type ProviderMatch = {
  externalIdSha256: string;
  clientUserAgent: string;
  fbp?: string;
  fbc?: string;
  ttp?: string;
  ttclid?: string;
};

const sha256 = /^[a-f0-9]{64}$/i;
const token = /^[A-Za-z0-9._:-]{1,200}$/;

/**
 * Only consent-confirmed, product-server-supplied matching metadata.
 * No email, phone, IP, checkout URL query, raw customer ID or browser freeform
 * properties are copied into the provider delivery queue.
 */
export function sanitizeProviderMatch(raw: unknown): ProviderMatch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.externalIdSha256 !== "string" ||
      !sha256.test(data.externalIdSha256)) return null;
  if (typeof data.clientUserAgent !== "string" ||
      data.clientUserAgent.trim().length < 8 ||
      data.clientUserAgent.length > 512 ||
      /[\r\n\u0000-\u001f]/.test(data.clientUserAgent)) return null;

  const result: ProviderMatch = {
    externalIdSha256: data.externalIdSha256.toLowerCase(),
    clientUserAgent: data.clientUserAgent.trim()
  };
  for (const key of ["fbp", "fbc", "ttp", "ttclid"] as const) {
    const value = data[key];
    if (typeof value === "string" && token.test(value)) result[key] = value;
  }
  return result;
}

export function deliveryProvider(input: {
  source: string | null | undefined;
  marketingConsent: unknown;
  testTraffic: unknown;
}): DeliveryProvider | null {
  if (input.marketingConsent !== true || input.testTraffic === true) return null;
  const raw = input.source?.trim().toLowerCase() ?? "";
  if (["meta", "facebook", "instagram", "fb", "ig"].includes(raw)) return "meta";
  if (["tiktok", "tt"].includes(raw)) return "tiktok";
  return null;
}

export function deliveryPayload(input: {
  conversionId: string;
  providerEvent: string;
  occurredAt: string;
  value: number | null;
  currency: string | null;
  pageId: string;
  variationId: string | null;
  packageCode: string | null;
  matching?: ProviderMatch | null;
}) {
  return {
    event_id: `growthos_${input.conversionId}`,
    event: input.providerEvent,
    occurred_at: input.occurredAt,
    value: input.value,
    currency: input.currency,
    page_id: input.pageId,
    variation_id: input.variationId,
    package_code: input.packageCode,
    ...(input.matching ? { matching: input.matching } : {})
  };
}
