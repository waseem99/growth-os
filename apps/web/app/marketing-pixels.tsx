"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { PublicMarketingPixels } from "../lib/public-marketing-pixels";

type Provider = "meta" | "tiktok";
type Preference = "accepted" | "rejected" | "unknown";
type PixelFn = (...args: unknown[]) => void;
type TikTokFn = ((...args: unknown[]) => void) & {
  methods?: string[];
  _i?: Record<string, unknown[]>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
  load?: (pixel: string) => void;
  page?: () => void;
  revokeConsent?: () => void;
};
type PixelWindow = Window & { fbq?: PixelFn; _fbq?: PixelFn; ttq?: TikTokFn };

function loadMetaPixel(id: string) {
  const win = window as PixelWindow;
  if (typeof win.fbq !== "function") {
    const q = function (...args: unknown[]) { (q as PixelFn & { queue: unknown[][] }).queue.push(args); } as PixelFn & { queue: unknown[][]; loaded?: boolean; version?: string };
    q.queue = [];
    q.loaded = true;
    q.version = "2.0";
    win.fbq = q;
    win._fbq = q;
    if (!document.querySelector('script[data-growthos-pixel="meta"]')) {
      const script = document.createElement("script");
      script.async = true;
      script.dataset.growthosPixel = "meta";
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
  }
  win.fbq?.("consent", "grant");
  win.fbq?.("init", id);
  win.fbq?.("trackSingle", id, "PageView");
}

function loadTikTokPixel(id: string) {
  const win = window as PixelWindow;
  if (!win.ttq) {
    const queue = [] as unknown as TikTokFn & unknown[] & { push: (event: unknown[]) => number };
    const methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
    queue.methods = methods;
    for (const method of methods) (queue as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => queue.push([method, ...args]);
    queue._i = {};
    queue._t = {};
    queue._o = {};
    queue.load = (pixel: string) => {
      const endpoint = "https://analytics.tiktok.com/i18n/pixel/events.js";
      queue._i![pixel] = [];
      queue._t![pixel] = Date.now();
      queue._o![pixel] = {};
      if (!document.querySelector('script[data-growthos-pixel="tiktok"]')) {
        const script = document.createElement("script");
        script.async = true;
        script.dataset.growthosPixel = "tiktok";
        script.src = `${endpoint}?sdkid=${encodeURIComponent(pixel)}&lib=ttq`;
        document.head.appendChild(script);
      }
    };
    win.ttq = queue;
  }
  win.ttq?.load?.(id);
  win.ttq?.page?.();
}

function revokePixels() {
  const win = window as PixelWindow;
  win.fbq?.("consent", "revoke");
  win.ttq?.revokeConsent?.();
}

/**
 * Marketing pixels load only after explicit permission. Page views are not
 * conversions. Successful purchases/subscriptions originate downstream.
 */
export function MarketingPixels({ brandId, source, pixels }: {
  brandId: string;
  source: string | null;
  pixels: PublicMarketingPixels;
}) {
  const provider: Provider | null = source === "meta" ? "meta" : source === "tiktok" ? "tiktok" : null;
  const pixelId = provider === "meta" ? pixels.meta : provider === "tiktok" ? pixels.tiktok : null;
  const key = `growthos.marketing-consent.v1.${brandId}`;
  const preference = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener("growthos:marketing-consent", onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener("growthos:marketing-consent", onChange);
      };
    },
    () => {
      try {
        const saved = localStorage.getItem(key);
        return saved === "accepted" || saved === "rejected" ? saved : "unknown";
      } catch { return "rejected"; }
    },
    () => "unknown"
  ) as Preference;

  useEffect(() => {
    if (preference !== "accepted" || !provider || !pixelId) return;
    if (provider === "meta") loadMetaPixel(pixelId);
    if (provider === "tiktok") loadTikTokPixel(pixelId);
  }, [preference, provider, pixelId]);

  if (!provider || !pixelId) return null;
  const choose = (value: "accepted" | "rejected") => {
    try { localStorage.setItem(key, value); } catch { return; }
    if (value === "rejected") revokePixels();
    window.dispatchEvent(new Event("growthos:marketing-consent"));
  };

  return <aside aria-label="Marketing measurement preferences" style={{
    position: "fixed", bottom: 12, right: 12, zIndex: 2000,
    background: "white", color: "#222", border: "1px solid #ddd",
    borderRadius: 12, padding: 12, maxWidth: 340, boxShadow: "0 2px 16px #0002"
  }}>
    {preference === "unknown" ? <>
      <strong>Marketing measurement</strong>
      <p style={{ fontSize: 13 }}>Allow this product to use advertising measurement cookies? You can decline and continue using the page.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => choose("accepted")}>Allow</button>
        <button type="button" onClick={() => choose("rejected")}>Decline</button>
      </div>
    </> : <button type="button" onClick={() => choose(preference === "accepted" ? "rejected" : "accepted")} style={{ fontSize: 12 }}>
      {preference === "accepted" ? "Disable marketing measurement" : "Enable marketing measurement"}
    </button>}
  </aside>;
}
