import { describe, expect, it } from "vitest";

import {
  applyOverrides,
  assignableRoles,
  isPermission,
  isRole,
  PERMISSION_META,
  PERMISSION_SET,
  PERMISSIONS,
  permissionsForRole,
  resolveCustomRolePermissions,
  resolveEffectivePermissions,
  ROLE_META,
  ROLE_PERMISSIONS,
  ROLES,
  sanitizePermissions,
  type Permission,
  type Role,
} from ".";

describe("permission catalog", () => {
  it("has no duplicate permissions", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("describes every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(PERMISSION_META[permission], permission).toBeDefined();
      expect(PERMISSION_META[permission].label.length).toBeGreaterThan(0);
    }
  });

  it("recognises catalog members and rejects strangers", () => {
    expect(isPermission("clients.view")).toBe(true);
    expect(isPermission("clients.teleport")).toBe(false);
    expect(isRole("owner")).toBe(true);
    expect(isRole("wizard")).toBe(false);
  });

  it("only grants permissions that exist in the catalog", () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSION_SET.has(permission), `${role} -> ${permission}`).toBe(
          true,
        );
      }
      // No duplicates within a role.
      expect(new Set(ROLE_PERMISSIONS[role]).size).toBe(
        ROLE_PERMISSIONS[role].length,
      );
    }
  });

  it("describes every role", () => {
    for (const role of ROLES) {
      expect(ROLE_META[role].label.length).toBeGreaterThan(0);
      expect(ROLE_META[role].description.length).toBeGreaterThan(0);
    }
  });
});

describe("predefined roles", () => {
  it("owner and admin hold every permission", () => {
    expect(permissionsForRole("owner")).toEqual(new Set(PERMISSIONS));
    expect(permissionsForRole("admin")).toEqual(new Set(PERMISSIONS));
  });

  it("orders the privilege ladder owner >= admin >= manager >= member", () => {
    const owner = permissionsForRole("owner");
    const admin = permissionsForRole("admin");
    const manager = permissionsForRole("manager");
    const member = permissionsForRole("member");

    const isSubset = (a: Set<Permission>, b: Set<Permission>) =>
      [...a].every((p) => b.has(p));

    expect(isSubset(member, manager)).toBe(true);
    expect(isSubset(manager, admin)).toBe(true);
    expect(isSubset(admin, owner)).toBe(true);
    // The ladder is strict at the team-management rungs.
    expect(member.has("team.invite")).toBe(false);
    expect(manager.has("team.invite")).toBe(true);
    expect(manager.has("team.manageRoles")).toBe(false);
    expect(admin.has("team.manageRoles")).toBe(true);
  });

  it("keeps the member role exactly at today's capabilities", () => {
    // Behaviour preservation: a legacy member could do everything except
    // team management, settings/branding edits and invoice numbering.
    const member = permissionsForRole("member");
    expect(member.has("invoices.issue")).toBe(true);
    expect(member.has("expenses.delete")).toBe(true);
    expect(member.has("settings.view")).toBe(true);
    expect(member.has("settings.edit")).toBe(false);
    expect(member.has("branding.edit")).toBe(false);
    expect(member.has("invoices.configure")).toBe(false);
    expect(member.has("team.invite")).toBe(false);
  });

  it("scopes the specialised roles", () => {
    const viewer = permissionsForRole("viewer");
    expect([...viewer].every((p) => p.endsWith(".view") || p.endsWith(".viewOwn"))).toBe(
      true,
    );

    const contractor = permissionsForRole("contractor");
    expect(contractor.has("time.log")).toBe(true);
    expect(contractor.has("clients.view")).toBe(false);
    expect(contractor.has("invoices.view")).toBe(false);

    const accountant = permissionsForRole("accountant");
    expect(accountant.has("invoices.configure")).toBe(true);
    expect(accountant.has("expenses.approve")).toBe(true);
    expect(accountant.has("projects.create")).toBe(false);
  });
});

describe("resolveEffectivePermissions", () => {
  it("returns the role set when there are no overrides", () => {
    expect(resolveEffectivePermissions("viewer")).toEqual(
      permissionsForRole("viewer"),
    );
  });

  it("a grant adds a permission the role lacks", () => {
    const result = resolveEffectivePermissions("viewer", [
      { permission: "clients.create", effect: "grant" },
    ]);
    expect(result.has("clients.create")).toBe(true);
  });

  it("a deny removes a permission the role has", () => {
    const result = resolveEffectivePermissions("member", [
      { permission: "invoices.issue", effect: "deny" },
    ]);
    expect(result.has("invoices.issue")).toBe(false);
  });

  it("deny wins over grant for the same permission", () => {
    const result = resolveEffectivePermissions("viewer", [
      { permission: "clients.create", effect: "grant" },
      { permission: "clients.create", effect: "deny" },
    ]);
    expect(result.has("clients.create")).toBe(false);
  });

  it("never reduces an owner, ignoring overrides entirely", () => {
    const result = resolveEffectivePermissions("owner", [
      { permission: "invoices.issue", effect: "deny" },
      { permission: "settings.edit", effect: "deny" },
    ]);
    expect(result).toEqual(new Set(PERMISSIONS));
  });

  it("does not mutate the role's canonical set", () => {
    const before = permissionsForRole("viewer").size;
    resolveEffectivePermissions("viewer", [
      { permission: "clients.create", effect: "grant" },
    ]);
    expect(permissionsForRole("viewer").size).toBe(before);
  });
});

describe("custom roles", () => {
  it("sanitizePermissions keeps only valid, unique catalog entries", () => {
    const result = sanitizePermissions([
      "clients.view",
      "clients.view", // duplicate
      "clients.teleport", // unknown
      "invoices.issue",
    ]);
    expect(result.sort()).toEqual(["clients.view", "invoices.issue"]);
  });

  it("resolveCustomRolePermissions uses the role's own list, never a wildcard", () => {
    const perms: Permission[] = ["clients.view", "time.log"];
    const result = resolveCustomRolePermissions(perms);
    expect(result).toEqual(new Set(perms));
  });

  it("applies overrides on top of a custom role (deny wins)", () => {
    const result = resolveCustomRolePermissions(["clients.view", "time.log"], [
      { permission: "invoices.view", effect: "grant" },
      { permission: "time.log", effect: "deny" },
    ]);
    expect(result.has("invoices.view")).toBe(true);
    expect(result.has("time.log")).toBe(false);
    expect(result.has("clients.view")).toBe(true);
  });

  it("applyOverrides mutates and returns the same set", () => {
    const base = new Set<Permission>(["clients.view"]);
    const out = applyOverrides(base, [
      { permission: "clients.create", effect: "grant" },
    ]);
    expect(out).toBe(base);
    expect(base.has("clients.create")).toBe(true);
  });
});

describe("assignableRoles", () => {
  it("lets only owners assign the owner role", () => {
    expect(assignableRoles("owner")).toContain("owner");
    for (const role of ROLES.filter((r) => r !== "owner") as Role[]) {
      expect(assignableRoles(role)).not.toContain("owner");
    }
  });

  it("never offers a role outside the catalog", () => {
    for (const role of ROLES) {
      for (const assignable of assignableRoles(role)) {
        expect(ROLES).toContain(assignable);
      }
    }
  });
});
