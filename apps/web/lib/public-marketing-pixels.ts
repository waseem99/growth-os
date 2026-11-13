import { and, eq } from "drizzle-orm";
import { getDatabase, integrations } from "@growth-os/db";

export type PublicMarketingPixels = { meta: string | null; tiktok: string | null };
const text = (raw: unknown, provider: string) => {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return provider === "meta"
    ? /^\d{6,30}$/.test(value) ? value : null
    : /^[a-zA-Z0-9_-]{6,80}$/.test(value) ? value : null;
};

/** Only public Pixel identifiers are returned. No secret references or API credentials. */
export async function resolvePublicMarketingPixels(brandId: string): Promise<PublicMarketingPixels> {
  const { db, client } = getDatabase();
  try {
    const rows = await db.select({ provider: integrations.provider, publicConfig: integrations.publicConfig })
      .from(integrations).where(and(eq(integrations.brandId, brandId), eq(integrations.status, "enabled")));
    const pixels: PublicMarketingPixels = { meta: null, tiktok: null };
    for (const row of rows) {
      if (row.provider === "meta" || row.provider === "tiktok") {
        pixels[row.provider] = text(row.publicConfig.pixelId, row.provider);
      }
    }
    return pixels;
  } finally { await client.end(); }
}
