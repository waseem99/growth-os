import { z } from "zod";

export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "landing_view",
  "cta_click",
  "scroll_depth",
  "video_start",
  "video_complete",
  "signup_start",
  "signup_complete",
  "checkout_start",
  "purchase",
  "subscription_started"
] as const;

export const CONVERSION_EVENT_NAMES = ["signup_complete", "purchase", "subscription_started"] as const;

const nullableText = z.string().trim().max(240).nullable().optional();
const uuidNullable = z.string().uuid().nullable().optional();
const properties = z.record(z.string(), z.unknown()).default({});

export const attributionTouchSchema = z.object({
  source: nullableText,
  medium: nullableText,
  campaign: nullableText,
  term: nullableText,
  content: nullableText,
  creativeId: nullableText,
  capturedAt: z.string().datetime()
});

export const attributionEnvelopeSchema = z.object({
  firstTouch: attributionTouchSchema.nullable().default(null),
  lastTouch: attributionTouchSchema.nullable().default(null)
});

export const analyticsEventInputSchema = z.object({
  eventId: z.string().trim().min(8).max(160),
  eventName: z.enum(ANALYTICS_EVENT_NAMES),
  occurredAt: z.string().datetime(),
  brandId: z.string().uuid(),
  campaignId: uuidNullable,
  pageId: z.string().uuid(),
  versionId: z.string().uuid(),
  variantId: uuidNullable,
  creativeId: nullableText,
  sessionId: z.string().trim().min(8).max(160),
  anonymousId: z.string().trim().min(8).max(160),
  userId: nullableText,
  source: nullableText,
  medium: nullableText,
  campaignName: nullableText,
  term: nullableText,
  content: nullableText,
  properties
});

export const conversionInputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(180),
  eventName: z.enum(CONVERSION_EVENT_NAMES),
  occurredAt: z.string().datetime(),
  brandId: z.string().uuid(),
  campaignId: uuidNullable,
  pageId: z.string().uuid(),
  versionId: z.string().uuid(),
  variantId: uuidNullable,
  sessionId: z.string().trim().min(8).max(160).nullable().optional(),
  value: z.coerce.number().nonnegative().max(1_000_000_000).nullable().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).nullable().optional(),
  attribution: attributionEnvelopeSchema.default({ firstTouch: null, lastTouch: null }),
  properties
});

export type AttributionTouch = z.infer<typeof attributionTouchSchema>;
export type AttributionEnvelope = z.infer<typeof attributionEnvelopeSchema>;
export type AnalyticsEventInput = z.infer<typeof analyticsEventInputSchema>;
export type ConversionInput = z.infer<typeof conversionInputSchema>;
