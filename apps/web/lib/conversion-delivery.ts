/**
 * Provider delivery is conditional on a trusted product-backend consent
 * assertion. URL parameters or browser click events cannot establish it.
 */
export type DeliveryProvider = "meta" | "tiktok";

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
}) {
  return {
    event_id: `growthos_${input.conversionId}`,
    event: input.providerEvent,
    occurred_at: input.occurredAt,
    value: input.value,
    currency: input.currency,
    page_id: input.pageId,
    variation_id: input.variationId,
    package_code: input.packageCode
  };
}
