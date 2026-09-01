import { eq } from "drizzle-orm";
import { getDatabase, users } from "@growth-os/db";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission, type GrowthRole, type Permission } from "@/lib/authz";

export async function findAllowedUser(email: string) {
  const normalized = email.trim().toLowerCase();
  const { db, client } = getDatabase();
  try {
    const [user] = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status })
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);
    return user ?? null;
  } finally {
    await client.end();
  }
}

export async function requireGrowthUser() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const user = await findAllowedUser(session.user.email);
  if (!user || user.status !== "active") redirect("/login?reason=access");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireGrowthUser();
  if (!hasPermission(user.role as GrowthRole, permission)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
