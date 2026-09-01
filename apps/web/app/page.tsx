import { headers } from "next/headers";
import { resolveBrandByHost } from "../lib/brand-resolution";

const field = (obj: unknown, key: string, fallback: string) => typeof obj === "object" && obj !== null && typeof (obj as Record<string, unknown>)[key] === "string" ? String((obj as Record<string, unknown>)[key]) : fallback;

export default async function RendererHome() {
  const host = (await headers()).get("host");
  const brand = await resolveBrandByHost(host ?? "");
  if (!brand) {
    return <main><section><p className="eyebrow">GrowthOS renderer</p><h1>Public landing-page engine ready.</h1><p>This host is not mapped to an active GrowthOS brand. Configure and verify a domain in the internal portal.</p></section></main>;
  }
  const primary = field(brand.theme, "primary", "#6236ff");
  const background = field(brand.theme, "background", "#ffffff");
  const text = field(brand.theme, "text", "#101014");
  return <main style={{ background, color: text }}><section><p className="eyebrow" style={{ color: primary }}>{brand.name}</p><h1>{field(brand.defaults, "defaultSeoTitle", `${brand.name} acquisition pages`)}</h1><p>GrowthOS resolved <strong>{brand.hostname}</strong> to this brand without product-specific application code.</p></section></main>;
}
