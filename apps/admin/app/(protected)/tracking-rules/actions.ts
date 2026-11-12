"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  brands, conversionEventRules, getDatabase, productPackages
} from "@growth-os/db";
import {
  CONVERSION_PROVIDER_EVENTS, canonicalProviderEvent,
  type ConversionProvider, type CanonicalConversionEvent
} from "@growth-os/tracking";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/user-access";

const val = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

export async function saveConversionEventRule(form: FormData) {
  const actor = await requirePermission("integrations:manage");
  const brandId = val(form, "brandId");
  const packageId = val(form, "packageId") || null;
  const provider = val(form, "provider");
  const canonicalEvent = val(form, "canonicalEvent");
  const status = val(form, "status") === "enabled" ? "enabled" : "disabled";
  if (!Object.hasOwn(CONVERSION_PROVIDER_EVENTS, provider) ||
      !Object.hasOwn(CONVERSION_PROVIDER_EVENTS.meta, canonicalEvent)) {
    throw new Error("INVALID_CONVERSION_EVENT_RULE");
  }
  const approvedProvider = provider as ConversionProvider;
  const approvedEvent = canonicalEvent as CanonicalConversionEvent;
  const providerEvent = canonicalProviderEvent(approvedProvider, approvedEvent);
  const { db, client } = getDatabase();
  let id = "";
  try {
    await db.transaction(async (tx) => {
      const [brand] = await tx.select({ id: brands.id }).from(brands)
        .where(and(eq(brands.id, brandId), eq(brands.status, "active"))).limit(1);
      if (!brand) throw new Error("ACTIVE_PRODUCT_NOT_FOUND");
      if (packageId) {
        const [pkg] = await tx.select({ id: productPackages.id, status: productPackages.status })
          .from(productPackages).where(and(eq(productPackages.id, packageId), eq(productPackages.brandId, brandId))).limit(1);
        if (!pkg || (status === "enabled" && pkg.status !== "active")) {
          throw new Error("CROSS_PRODUCT_OR_INACTIVE_PACKAGE");
        }
      }
      const [rule] = await tx.insert(conversionEventRules).values({
        brandId, packageId, provider: approvedProvider,
        canonicalEvent: approvedEvent, providerEvent, status, updatedBy: actor.id
      }).onConflictDoUpdate({
        target: [
          conversionEventRules.brandId, conversionEventRules.packageId,
          conversionEventRules.provider, conversionEventRules.canonicalEvent
        ],
        set: { providerEvent, status, updatedBy: actor.id, updatedAt: new Date() }
      }).returning({ id: conversionEventRules.id });
      if (!rule) throw new Error("RULE_SAVE_FAILED");
      id = rule.id;
    });
  } finally { await client.end(); }
  await writeAudit({
    actorUserId: actor.id, action: "conversion_event_rule.saved",
    entityType: "conversion_event_rule", entityId: id,
    after: { brandId, packageId, provider: approvedProvider, canonicalEvent: approvedEvent, providerEvent, status }
  });
  revalidatePath("/tracking-rules");
}
