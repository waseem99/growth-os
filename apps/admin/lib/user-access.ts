import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission, type GrowthRole, type Permission } from "@/lib/authz";
import { findAllowedUser } from "@/lib/user-repository";

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
