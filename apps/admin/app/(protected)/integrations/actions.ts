"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { brands, getDatabase, integrations } from "@growth-os/db";
import { requirePermission } from "@/lib/user-access";

const PROVIDERS = new Set(["meta", "tiktok", "ga4", "gtm"] as const);
const clean = (value: FormDataEntryValue | null, max = 240) => String(value ?? "").trim().slice(0, max);

export async function savePublicIntegration(formData: FormData) {
  await requirePermission("integrations:manage");
  const brandId = clean(formData.get("brandId"), 80);
  const provider = clean(formData.get("provider"), 40) as "meta" | "tiktok" | "ga4" | "gtm";
  const enabled = formData.get("enabled") === "on";
  if (!brandId || !PROVIDERS.has(provider)) throw new Error("INVALID_INTEGRATION_INPUT");

  const { db, client } = getDatabase();
  try {
    const [brand] = await db.select({ id: brands.id }).from(brands).where(eq(brands.id, brandId)).limit(1);
    if (!brand) throw new Error("BRAND_NOT_FOUND");
    const publicConfig = provider === "meta" ? { pixelId: clean(formData.get("pixelId"), 120) || null }
      : provider === "tiktok" ? { pixelId: clean(formData.get("pixelId"), 120) || null }
      : provider === "ga4" ? { measurementId: clean(formData.get("measurementId"), 120) || null }
      : { containerId: clean(formData.get("containerId"), 120) || null };
    await db.insert(integrations).values({
      brandId,
      provider,
      status: enabled ? "enabled" : "disabled",
      publicConfig,
      secretRef: null
    }).onConflictDoUpdate({
      target: [integrations.brandId, integrations.provider],
      set: { status: enabled ? "enabled" : "disabled", publicConfig, updatedAt: new Date() }
    });
  } finally {
    await client.end();
  }
  revalidatePath("/integrations");
}
