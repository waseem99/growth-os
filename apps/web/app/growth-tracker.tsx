"use client";

import { useEffect } from "react";
import {
  ANALYTICS_EVENT_NAMES,
  attributionEnvelopeSchema,
  attributionTouchFromQuery,
  eventUtmFields,
  nextAttribution,
  type AttributionEnvelope,
  type AnalyticsEventInput
} from "@growth-os/tracking";

type TrackingContext = {
  brandId: string;
  campaignId: string | null;
  pageId: string;
  versionId: string;
  variantId?: string | null;
  defaultUtm?: Record<string, unknown> | null;
};

const ATTRIBUTION_KEY = "growthos.attribution.v1";
const ANONYMOUS_KEY = "growthos.anonymous.v1";
const SESSION_KEY = "growthos.session.v1";
const EVENT_NAMES = new Set<string>(ANALYTICS_EVENT_NAMES);

function safeEnvelope(raw: string | null): AttributionEnvelope | null {
  if (!raw) return null;
  try {
    const parsed = attributionEnvelopeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function stableId(storage: Storage, key: string) {
  const current = storage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  storage.setItem(key, created);
  return created;
}

function stringDefault(defaults: Record<string, unknown> | null | undefined, key: string) {
  const value = defaults?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function send(payload: AnalyticsEventInput) {
  const body = JSON.stringify(payload);
  if (typeof navigator.sendBeacon === "function") {
    const queued = navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    if (queued) return;
  }
  void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "same-origin" });
}

function textLabel(element: Element) {
  return (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

export function GrowthTracker({ context }: { context: TrackingContext }) {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const defaults = context.defaultUtm;
    const touch = attributionTouchFromQuery({
      utm_source: query.get("utm_source") ?? stringDefault(defaults, "source"),
      utm_medium: query.get("utm_medium") ?? stringDefault(defaults, "medium"),
      utm_campaign: query.get("utm_campaign") ?? stringDefault(defaults, "campaign"),
      utm_term: query.get("utm_term") ?? stringDefault(defaults, "term"),
      utm_content: query.get("utm_content") ?? stringDefault(defaults, "content"),
      creative_id: query.get("creative_id") ?? stringDefault(defaults, "creativeId") ?? stringDefault(defaults, "content")
    });
    const attribution = nextAttribution(safeEnvelope(localStorage.getItem(ATTRIBUTION_KEY)), touch);
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    const anonymousId = stableId(localStorage, ANONYMOUS_KEY);
    const sessionId = stableId(sessionStorage, SESSION_KEY);
    const utm = eventUtmFields(attribution);

    const emit = (eventName: AnalyticsEventInput["eventName"], properties: Record<string, unknown> = {}) => send({
      eventId: crypto.randomUUID(),
      eventName,
      occurredAt: new Date().toISOString(),
      brandId: context.brandId,
      campaignId: context.campaignId,
      pageId: context.pageId,
      versionId: context.versionId,
      variantId: context.variantId ?? null,
      creativeId: utm.creativeId,
      sessionId,
      anonymousId,
      source: utm.source,
      medium: utm.medium,
      campaignName: utm.campaignName,
      term: utm.term,
      content: utm.content,
      properties: { ...properties, firstTouch: attribution.firstTouch, lastTouch: attribution.lastTouch }
    });

    for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const raw = anchor.getAttribute("href");
      if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;
      try {
        const url = new URL(raw, window.location.href);
        if (!/^https?:$/.test(url.protocol)) continue;
        if (utm.source && !url.searchParams.has("utm_source")) url.searchParams.set("utm_source", utm.source);
        if (utm.medium && !url.searchParams.has("utm_medium")) url.searchParams.set("utm_medium", utm.medium);
        if (utm.campaignName && !url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", utm.campaignName);
        if (utm.term && !url.searchParams.has("utm_term")) url.searchParams.set("utm_term", utm.term);
        if (utm.content && !url.searchParams.has("utm_content")) url.searchParams.set("utm_content", utm.content);
        if (utm.creativeId && !url.searchParams.has("creative_id")) url.searchParams.set("creative_id", utm.creativeId);
        anchor.href = url.toString();
      } catch {
        // Leave malformed/non-URL CTA values untouched; page schema/publish validation owns those.
      }
    }

    emit("landing_view", { path: window.location.pathname });

    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a,button") : null;
      if (!target) return;
      emit("cta_click", {
        element: target.tagName.toLowerCase(),
        label: textLabel(target),
        href: target instanceof HTMLAnchorElement ? target.getAttribute("href") : null
      });
    };

    const seen = new Set<number>();
    const scroll = () => {
      const root = document.documentElement;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      const percent = Math.min(100, Math.round((window.scrollY / max) * 100));
      for (const threshold of [25, 50, 75, 100]) {
        if (percent >= threshold && !seen.has(threshold)) {
          seen.add(threshold);
          emit("scroll_depth", { percent: threshold });
        }
      }
    };

    const video = (event: Event) => {
      if (!(event.target instanceof HTMLVideoElement)) return;
      emit(event.type === "play" ? "video_start" : "video_complete", { currentTime: Math.round(event.target.currentTime) });
    };

    let checkoutStarted = false;
    const focus = (event: FocusEvent) => {
      if (checkoutStarted || !(event.target instanceof Element) || !event.target.closest("#checkout")) return;
      checkoutStarted = true;
      emit("checkout_start", { trigger: "checkout_focus" });
    };

    const custom = (event: Event) => {
      if (!(event instanceof CustomEvent) || !event.detail || typeof event.detail !== "object") return;
      const detail = event.detail as { eventName?: unknown; properties?: unknown };
      if (typeof detail.eventName !== "string" || !EVENT_NAMES.has(detail.eventName)) return;
      const properties = detail.properties && typeof detail.properties === "object" ? detail.properties as Record<string, unknown> : {};
      emit(detail.eventName as AnalyticsEventInput["eventName"], properties);
    };

    document.addEventListener("click", click, true);
    document.addEventListener("focusin", focus, true);
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("play", video, true);
    document.addEventListener("ended", video, true);
    window.addEventListener("growthos:event", custom);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("focusin", focus, true);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("play", video, true);
      document.removeEventListener("ended", video, true);
      window.removeEventListener("growthos:event", custom);
    };
  }, [context.brandId, context.campaignId, context.defaultUtm, context.pageId, context.variantId, context.versionId]);

  return null;
}
