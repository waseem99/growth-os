export type GrowthRole = "owner" | "admin" | "editor" | "analyst";
export type GrowthUserStatus = "active" | "disabled";

export type Permission =
  | "users:manage"
  | "brands:manage"
  | "campaigns:manage"
  | "pages:manage"
  | "assets:manage"
  | "integrations:manage"
  | "analytics:view";

const permissionMatrix: Record<GrowthRole, ReadonlySet<Permission>> = {
  owner: new Set(["users:manage", "brands:manage", "campaigns:manage", "pages:manage", "assets:manage", "integrations:manage", "analytics:view"]),
  admin: new Set(["users:manage", "brands:manage", "campaigns:manage", "pages:manage", "assets:manage", "integrations:manage", "analytics:view"]),
  editor: new Set(["campaigns:manage", "pages:manage", "assets:manage", "analytics:view"]),
  analyst: new Set(["analytics:view"])
};

export function hasPermission(role: GrowthRole, permission: Permission) {
  return permissionMatrix[role].has(permission);
}

export function canManageRole(actor: GrowthRole, target: GrowthRole) {
  if (actor === "owner") return true;
  if (actor === "admin") return target !== "owner";
  return false;
}
