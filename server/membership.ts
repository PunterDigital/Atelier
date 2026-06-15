import { asc, eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import {
  applyOverrides,
  isPermission,
  isRole,
  permissionsForRole,
  ROLE_META,
  sanitizePermissions,
  type Permission,
  type PermissionEffect,
  type StoredRole,
} from "@/modules/authz";

export type ActiveMembership = {
  businessMemberId: string;
  businessId: string;
  role: StoredRole;
  // Set when role is "custom": the business-defined role the member holds.
  customRoleId: string | null;
  // Human label for the member's role (a predefined role label or the custom
  // role's name), for display.
  roleName: string;
  // The member's resolved permissions: their role's set (predefined or custom)
  // with per-member overrides applied (see modules/authz). Every
  // business-scoped procedure gates on this.
  permissions: Set<Permission>;
};

// Single source of truth for resolving a user's active business and what they
// may do in it. Until multi-entity switching lands (Phase 4), the active
// business is the oldest membership - deterministic, and correct for the
// single-business case.
export async function getActiveMembership(
  userId: string,
): Promise<ActiveMembership | null> {
  const db = getDb();
  const [membership] = await db
    .select({
      id: schema.businessMember.id,
      businessId: schema.businessMember.businessId,
      role: schema.businessMember.role,
      businessRoleId: schema.businessMember.businessRoleId,
    })
    .from(schema.businessMember)
    .where(eq(schema.businessMember.userId, userId))
    .orderBy(asc(schema.businessMember.createdAt))
    .limit(1);

  if (!membership) return null;

  const base = {
    businessMemberId: membership.id,
    businessId: membership.businessId,
    role: membership.role,
    customRoleId: membership.businessRoleId,
  };

  // The owner wildcard is absolute: full permissions, overrides ignored.
  if (membership.role === "owner") {
    return {
      ...base,
      roleName: ROLE_META.owner.label,
      permissions: permissionsForRole("owner"),
    };
  }

  const overrideRows = await db
    .select({
      permission: schema.businessMemberPermission.permission,
      effect: schema.businessMemberPermission.effect,
    })
    .from(schema.businessMemberPermission)
    .where(eq(schema.businessMemberPermission.businessMemberId, membership.id));
  const overrides = overrideRows.filter((row) =>
    isPermission(row.permission),
  ) as { permission: Permission; effect: PermissionEffect }[];

  // Custom role: its permissions come from the business_role row.
  if (membership.role === "custom" && membership.businessRoleId) {
    const [customRole] = await db
      .select({
        name: schema.businessRole.name,
        permissions: schema.businessRole.permissions,
      })
      .from(schema.businessRole)
      .where(eq(schema.businessRole.id, membership.businessRoleId));
    const rolePerms = sanitizePermissions(
      (customRole?.permissions as string[]) ?? [],
    );
    return {
      ...base,
      roleName: customRole?.name ?? "Custom role",
      permissions: applyOverrides(new Set(rolePerms), overrides),
    };
  }

  // Predefined role. (A "custom" sentinel with no role id is treated as having
  // no base permissions - a safe default for inconsistent data.)
  const roleKey = isRole(membership.role) ? membership.role : null;
  const basePerms = roleKey ? permissionsForRole(roleKey) : new Set<Permission>();
  return {
    ...base,
    roleName: roleKey ? ROLE_META[roleKey].label : "No role",
    permissions: applyOverrides(basePerms, overrides),
  };
}
