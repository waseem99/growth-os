"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDatabase, users } from "@growth-os/db";
import { canManageRole, type GrowthRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/user-access";

const validRoles = new Set<GrowthRole>(["owner", "admin", "editor", "analyst"]);

export async function createAllowedUser(formData: FormData) {
  const actor = await requirePermission("users:manage");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "analyst") as GrowthRole;
  if (!email.includes("@") || !validRoles.has(role)) throw new Error("INVALID_USER_INPUT");
  if (!canManageRole(actor.role as GrowthRole, role)) throw new Error("FORBIDDEN_ROLE_ASSIGNMENT");

  const { db, client } = getDatabase();
  let userId = "";
  let before: { role: GrowthRole; status: string } | null = null;
  try {
    const [existing] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) before = { role: existing.role as GrowthRole, status: existing.status };
    const [saved] = await db.insert(users).values({ email, role, status: "active" }).onConflictDoUpdate({
      target: users.email,
      set: { role, status: "active", updatedAt: new Date() }
    }).returning({ id: users.id });
    if (!saved) throw new Error("USER_SAVE_FAILED");
    userId = saved.id;
  } finally {
    await client.end();
  }
  await writeAudit({ actorUserId: actor.id, action: before ? "user.access_restored" : "user.allowlisted", entityType: "user", entityId: userId, before, after: { email, role, status: "active" } });
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
  let before: { role: GrowthRole; status: string } | null = null;
  try {
    const [target] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, id)).limit(1);
    if (!target || !canManageRole(actor.role as GrowthRole, target.role as GrowthRole)) throw new Error("FORBIDDEN_TARGET");
    before = { role: target.role as GrowthRole, status: target.status };
    await db.update(users).set({ role, status, updatedAt: new Date() }).where(eq(users.id, id));
  } finally {
    await client.end();
  }
  await writeAudit({ actorUserId: actor.id, action: "user.access_updated", entityType: "user", entityId: id, before, after: { role, status } });
  revalidatePath("/users");
}
