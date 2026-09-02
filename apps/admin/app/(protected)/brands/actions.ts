"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDatabase, brands, domains } from "@growth-os/db";
import { writeAudit } from "@/lib/audit";
import { normalizeHostname, normalizeSlug, parseDefaults, parseTheme } from "@/lib/brand-input";
import { requirePermission } from "@/lib/user-access";

export async function createBrand(formData: FormData) {
  const actor = await requirePermission("brands:manage");
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  if (!name) throw new Error("INVALID_BRAND_NAME");
  const theme = parseTheme(formData);
  const defaults = parseDefaults(formData);
  const { db, client } = getDatabase();
  let id = "";
  try {
    const [created] = await db.insert(brands).values({ name, slug, theme, defaults, createdBy: actor.id, updatedBy: actor.id }).returning({ id: brands.id });
    if (!created) throw new Error("BRAND_CREATE_FAILED");
    id = created.id;
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "brand.created", entityType: "brand", entityId: id, after: { name, slug, status: "active" } });
  revalidatePath("/brands");
}

export async function updateBrand(formData: FormData) {
  const actor = await requirePermission("brands:manage");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const status = formData.get("status") === "archived" ? "archived" : "active";
  if (!id || !name) throw new Error("INVALID_BRAND_INPUT");
  const { db, client } = getDatabase();
  let before: Record<string, unknown> | null = null;
  try {
    const [existing] = await db.select({ name: brands.name, slug: brands.slug, status: brands.status }).from(brands).where(eq(brands.id, id)).limit(1);
    before = existing ?? null;
    await db.update(brands).set({ name, slug, status, theme: parseTheme(formData), defaults: parseDefaults(formData), updatedAt: new Date(), updatedBy: actor.id }).where(eq(brands.id, id));
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "brand.updated", entityType: "brand", entityId: id, before, after: { name, slug, status } });
  revalidatePath(`/brands/${id}`); revalidatePath("/brands");
}

export async function addDomain(formData: FormData) {
  const actor = await requirePermission("brands:manage");
  const brandId = String(formData.get("brandId") ?? "");
  const hostname = normalizeHostname(String(formData.get("hostname") ?? ""));
  if (!brandId) throw new Error("INVALID_BRAND");
  const requestedPrimary = formData.get("isPrimary") === "on";
  const { db, client } = getDatabase();
  let id = "";
  let makePrimary = requestedPrimary;
  try {
    await db.transaction(async (tx) => {
      const [existingDomain] = await tx.select({ id: domains.id }).from(domains).where(and(eq(domains.brandId, brandId), ne(domains.status, "disabled"))).limit(1);
      makePrimary = requestedPrimary || !existingDomain;
      if (makePrimary) await tx.update(domains).set({ isPrimary: false, updatedAt: new Date() }).where(eq(domains.brandId, brandId));
      const [created] = await tx.insert(domains).values({ brandId, hostname, isPrimary: makePrimary, status: "pending" }).returning({ id: domains.id });
      if (!created) throw new Error("DOMAIN_CREATE_FAILED");
      id = created.id;
    });
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "domain.created", entityType: "domain", entityId: id, after: { brandId, hostname, status: "pending", isPrimary: makePrimary } });
  revalidatePath(`/brands/${brandId}`);
}

export async function updateDomain(formData: FormData) {
  const actor = await requirePermission("brands:manage");
  const id = String(formData.get("id") ?? "");
  const brandId = String(formData.get("brandId") ?? "");
  const statusRaw = String(formData.get("status") ?? "pending");
  const status = statusRaw === "verified" || statusRaw === "disabled" ? statusRaw : "pending";
  const makePrimary = formData.get("isPrimary") === "on";
  if (!id || !brandId) throw new Error("INVALID_DOMAIN");
  const { db, client } = getDatabase();
  let before: Record<string, unknown> | null = null;
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select({ status: domains.status, isPrimary: domains.isPrimary, hostname: domains.hostname }).from(domains).where(and(eq(domains.id, id), eq(domains.brandId, brandId))).limit(1);
      before = existing ?? null;
      if (makePrimary) await tx.update(domains).set({ isPrimary: false, updatedAt: new Date() }).where(and(eq(domains.brandId, brandId), ne(domains.id, id)));
      await tx.update(domains).set({ status, isPrimary: makePrimary, updatedAt: new Date() }).where(and(eq(domains.id, id), eq(domains.brandId, brandId)));
    });
  } finally { await client.end(); }
  await writeAudit({ actorUserId: actor.id, action: "domain.updated", entityType: "domain", entityId: id, before, after: { brandId, status, isPrimary: makePrimary } });
  revalidatePath(`/brands/${brandId}`);
}
