import type { AttributionEnvelope, AttributionTouch } from "./schema";

export const ATTRIBUTION_QUERY_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "creative_id"] as const;

export function cleanAttributionValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 240) : null;
}

export function attributionTouchFromQuery(values: Record<string, string | null | undefined>, capturedAt = new Date().toISOString()): AttributionTouch | null {
  const touch: AttributionTouch = {
    source: cleanAttributionValue(values.utm_source),
    medium: cleanAttributionValue(values.utm_medium),
    campaign: cleanAttributionValue(values.utm_campaign),
    term: cleanAttributionValue(values.utm_term),
    content: cleanAttributionValue(values.utm_content),
    creativeId: cleanAttributionValue(values.creative_id ?? values.utm_content),
    capturedAt
  };
  return [touch.source, touch.medium, touch.campaign, touch.term, touch.content, touch.creativeId].some(Boolean) ? touch : null;
}

export function nextAttribution(existing: AttributionEnvelope | null | undefined, current: AttributionTouch | null): AttributionEnvelope {
  if (!current) return existing ?? { firstTouch: null, lastTouch: null };
  return {
    firstTouch: existing?.firstTouch ?? current,
    lastTouch: current
  };
}

export function eventUtmFields(attribution: AttributionEnvelope) {
  const touch = attribution.lastTouch ?? attribution.firstTouch;
  return {
    source: touch?.source ?? null,
    medium: touch?.medium ?? null,
    campaignName: touch?.campaign ?? null,
    term: touch?.term ?? null,
    content: touch?.content ?? null,
    creativeId: touch?.creativeId ?? null
  };
}
