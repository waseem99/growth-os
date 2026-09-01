"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDatabase, brands, domains } from "@growth-os/db";
import { normalizeHostname, normalizeSlug, parseDefaults, parseTheme } from "@/lib/brand-input";
import { requirePermission } from "@/lib/user-access";

export async function createBrand(formData: FormData) {
  const actor = await requirePermission("brands:manage");
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  if (!name) throw new Error("INVALID_BRAND_NAME");
  const { db, client } = getDatabase();
  try {
    await db.insert(brands).values({ name, slug, theme: parseTheme(formData), defaults: parseDefaults(formData), createdBy: actor.id, updatedBy: actor.id });
  } finally {
    await client.end();
  }
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
  try {
    await db.update(brands).set({ name, slug, status, theme: parseTheme(formData), defaults: parseDefaults(formData), updatedAt: new Date(), updatedBy: actor.id }).where(eq(brands.id, id));
  } finally {
    await client.end();
  }
  revalidatePath(`/brands/${id}`);
  revalidatePath("/brands");
}

export async function addDomain(formData: FormData) {
  await requirePermission("brands:manage");
  const brandId = String(formData.get("brandId") ?? "");
  const hostname = normalizeHostname(String(formData.get("hostname") ?? ""));
  if (!brandId) throw new Error("INVALID_BRAND");
  const makePrimary = formData.get("isPrimary") === "on";
  const { db, client } = getDatabase();
  try {
    await db.transaction(async (tx) => {
      if (makePrimary) await tx.update(domains).set({ isPrimary: false, updatedAt: new Date() }).where(eq(domains.brandId, brandId));
      await tx.insert(domains).values({ brandId, hostname, isPrimary: makePrimary, status: "pending" });
    });
  } finally {
    await client.end();
  }
  revalidatePath(`/brands/${brandId}`);
}

export async function updateDomain(formData: FormData) {
  await requirePermission("brands:manage");
  const id = String(formData.get("id") ?? "");
  const brandId = String(formData.get("brandId") ?? "");
  const statusRaw = String(formData.get("status") ?? "pending");
  const status = statusRaw === "verified" || statusRaw === "disabled" ? statusRaw : "pending";
  const makePrimary = formData.get("isPrimary") === "on";
  if (!id || !brandId) throw new Error("INVALID_DOMAIN");
  const { db, client } = getDatabase();
  try {
    await db.transaction(async (tx) => {
      if (makePrimary) await tx.update(domains).set({ isPrimary: false, updatedAt: new Date() }).where(and(eq(domains.brandId, brandId), ne(domains.id, id)));
      await tx.update(domains).set({ status, isPrimary: makePrimary, updatedAt: new Date() }).where(and(eq(domains.id, id), eq(domains.brandId, brandId)));
    });
  } finally {
    await client.end();
  }
  revalidatePath(`/brands/${brandId}`);
}
