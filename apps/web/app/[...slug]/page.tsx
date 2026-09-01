import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePublishedPage } from "../../lib/brand-resolution";

const field = (obj: unknown, key: string, fallback: string) => typeof obj === "object" && obj !== null && typeof (obj as Record<string, unknown>)[key] === "string" ? String((obj as Record<string, unknown>)[key]) : fallback;

export default async function PublishedPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const host = (await headers()).get("host") ?? "";
  const page = await resolvePublishedPage(host, slug.join("/"));
  if (!page) notFound();
  const primary = field(page.theme, "primary", "#6236ff");
  const background = field(page.theme, "background", "#ffffff");
  const text = field(page.theme, "text", "#101014");
  return <main style={{ background, color: text }}><section><p className="eyebrow" style={{ color: primary }}>{page.brandName}</p><h1>{page.pageName}</h1><p>Published version {page.versionNumber} is resolved from the active domain, brand and immutable publication pointer.</p></section></main>;
}
