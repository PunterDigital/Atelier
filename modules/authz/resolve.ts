// Resolving a member's effective permissions: start from their role's set,
// then apply per-member overrides. A grant adds a permission the role lacks;
// a deny removes one the role has. Deny always wins over grant. The owner role
// is absolute - it holds every permission and ignores overrides, so an owner
// can never be locked out of their own business.
//
// This is pure and the most heavily unit-tested piece of the authz layer
// (resolve.test.ts), because every gate in the app trusts its output.

import { isPermission, type Permission, type Role } from "./permissions";
import { permissionsForRole } from "./roles";

export type PermissionEffect = "grant" | "deny";

export type PermissionOverride = {
  permission: Permission;
  effect: PermissionEffect;
};

// Apply per-member overrides to a base permission set, in place. Grants run
// before denies so a deny on the same permission always wins.
export function applyOverrides(
  base: Set<Permission>,
  overrides: readonly PermissionOverride[],
): Set<Permission> {
  for (const { permission, effect } of overrides) {
    if (effect === "grant") base.add(permission);
  }
  for (const { permission, effect } of overrides) {
    if (effect === "deny") base.delete(permission);
  }
  return base;
}

export function resolveEffectivePermissions(
  role: Role,
  overrides: readonly PermissionOverride[] = [],
): Set<Permission> {
  // The owner wildcard is non-negotiable.
  if (role === "owner") return permissionsForRole(role);
  return applyOverrides(permissionsForRole(role), overrides);
}

// Effective permissions for a member on a custom role: the role's own list
// (custom roles are never the owner wildcard) with overrides layered on top.
export function resolveCustomRolePermissions(
  rolePermissions: readonly Permission[],
  overrides: readonly PermissionOverride[] = [],
): Set<Permission> {
  return applyOverrides(new Set(rolePermissions), overrides);
}

// Keep only valid, unique catalog permissions from arbitrary input. Used at
// the boundary when a custom role's permission list is read or written.
export function sanitizePermissions(values: readonly string[]): Permission[] {
  const seen = new Set<Permission>();
  for (const value of values) {
    if (isPermission(value)) seen.add(value);
  }
  return [...seen];
}

export function hasPermission(
  permissions: ReadonlySet<Permission>,
  permission: Permission,
): boolean {
  return permissions.has(permission);
}
