"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDatabase, users } from "@growth-os/db";
import { canManageRole, type GrowthRole } from "@/lib/authz";
import { requirePermission } from "@/lib/user-access";

const validRoles = new Set<GrowthRole>(["owner", "admin", "editor", "analyst"]);

export async function createAllowedUser(formData: FormData) {
  const actor = await requirePermission("users:manage");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "analyst") as GrowthRole;
  if (!email.includes("@") || !validRoles.has(role)) throw new Error("INVALID_USER_INPUT");
  if (!canManageRole(actor.role as GrowthRole, role)) throw new Error("FORBIDDEN_ROLE_ASSIGNMENT");

  const { db, client } = getDatabase();
  try {
    await db.insert(users).values({ email, role, status: "active" }).onConflictDoUpdate({
      target: users.email,
      set: { role, status: "active", updatedAt: new Date() }
    });
  } finally {
    await client.end();
  }
  revalidatePath("/users");
}

export async function updateAllowedUser(formData: FormData) {
  const actor = await requirePermission("users:manage");
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "analyst") as GrowthRole;
  const status = formData.get("status") === "disabled" ? "disabled" : "active";
  if (!id || !validRoles.has(role)) throw new Error("INVALID_USER_INPUT");
  if (!canManageRole(actor.role as GrowthRole, role)) throw new Error("FORBIDDEN_ROLE_ASSIGNMENT");
  if (id === actor.id && status === "disabled") throw new Error("CANNOT_DISABLE_SELF");

  const { db, client } = getDatabase();
  try {
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (!target || !canManageRole(actor.role as GrowthRole, target.role as GrowthRole)) throw new Error("FORBIDDEN_TARGET");
    await db.update(users).set({ role, status, updatedAt: new Date() }).where(eq(users.id, id));
  } finally {
    await client.end();
  }
  revalidatePath("/users");
}
