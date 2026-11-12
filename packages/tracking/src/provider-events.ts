/**
 * Standard web conversion events selected from verified provider catalogs.
 * Never equate page_view or cta_click with a successful conversion.
 */
export const CONVERSION_PROVIDER_EVENTS = {
  meta: {
    signup_complete: "CompleteRegistration",
    subscription_started: "Subscribe",
    purchase: "Purchase"
  },
  tiktok: {
    signup_complete: "CompleteRegistration",
    subscription_started: "Subscribe",
    purchase: "CompletePayment"
  }
} as const;

export type ConversionProvider = keyof typeof CONVERSION_PROVIDER_EVENTS;
export type CanonicalConversionEvent = keyof typeof CONVERSION_PROVIDER_EVENTS.meta;

export function canonicalProviderEvent(
  provider: ConversionProvider,
  event: CanonicalConversionEvent
): string {
  return CONVERSION_PROVIDER_EVENTS[provider][event];
}
