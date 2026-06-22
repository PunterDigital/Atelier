// Which permissions each predefined role grants. `owner` is a wildcard - it
// always holds every permission and is never reduced. The other roles are
// explicit subsets, kept here so the whole privilege ladder reads top to
// bottom in one place. The permission matrix test asserts every entry is a
// real permission and that the ladder stays consistent (e.g. admin >= member).

import {
  PERMISSIONS,
  type Permission,
  type Role,
  type StoredRole,
} from "./permissions";

// Operational building blocks, composed into roles below.
const CLIENTS_FULL = [
  "clients.view",
  "clients.create",
  "clients.edit",
  "clients.archive",
  "clients.manageRates",
] satisfies Permission[];

const PROJECTS_FULL = [
  "projects.view",
  "projects.create",
  "projects.edit",
] satisfies Permission[];

const TASKS_FULL = [
  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "tasks.delete",
] satisfies Permission[];

const TIME_FULL = [
  "time.log",
  "time.viewOwn",
  "time.viewAll",
  "time.edit",
  "time.delete",
] satisfies Permission[];

// Operational invoice work, excluding numbering configuration.
const INVOICES_OPS = [
  "invoices.view",
  "invoices.create",
  "invoices.edit",
  "invoices.issue",
  "invoices.markPaid",
] satisfies Permission[];

const EXPENSES_FULL = [
  "expenses.view",
  "expenses.create",
  "expenses.edit",
  "expenses.approve",
  "expenses.delete",
] satisfies Permission[];

// The full operational surface: everything a member can do today. Mapping the
// legacy `member` role to exactly this set keeps existing members' abilities
// unchanged when roles ship (see db migration 0012).
const MEMBER_PERMISSIONS = [
  ...CLIENTS_FULL,
  ...PROJECTS_FULL,
  ...TASKS_FULL,
  ...TIME_FULL,
  ...INVOICES_OPS,
  ...EXPENSES_FULL,
  "dashboard.view",
  "settings.view",
  "team.view",
] satisfies Permission[];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Wildcard: kept in sync with the catalog automatically.
  owner: [...PERMISSIONS],
  // Everything except the owner-only ownership concerns; admins manage roles,
  // settings, branding and numbering.
  admin: [...PERMISSIONS],
  // Delivery lead: full operational access plus team roster management.
  manager: [...MEMBER_PERMISSIONS, "team.invite", "team.removeMember"],
  // The behaviour-preserving default for existing members.
  member: [...MEMBER_PERMISSIONS],
  // Finance: full invoices (incl. numbering) and expenses, read elsewhere.
  accountant: [
    "clients.view",
    "projects.view",
    "tasks.view",
    "time.viewOwn",
    "time.viewAll",
    ...INVOICES_OPS,
    "invoices.configure",
    ...EXPENSES_FULL,
    "dashboard.view",
    // Finance owns the P&L view (income, expenses, what the business pays out).
    "reports.viewProfit",
    "settings.view",
    "team.view",
  ],
  // External: log time against assigned work, see only their own time.
  contractor: [
    "projects.view",
    "tasks.view",
    "time.log",
    "time.viewOwn",
    "dashboard.view",
  ],
  // Read-only across the workspace.
  viewer: [
    "clients.view",
    "projects.view",
    "tasks.view",
    "time.viewOwn",
    "invoices.view",
    "expenses.view",
    "dashboard.view",
    "team.view",
  ],
};

// admin differs from owner only in the ownership invariants enforced by the
// team service, not in the permission set - both hold the full catalog.

export function permissionsForRole(role: Role): Set<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

// Predefined roles a member with `actorRole` is allowed to assign. Only an
// owner may create another owner; everyone else who can manage roles may
// assign roles at or below admin (and any of the business's custom roles,
// handled separately by the router). A custom-role actor is never an owner.
export function assignableRoles(actorRole: StoredRole): Role[] {
  if (actorRole === "owner") return ["owner", "admin", "manager", "member", "accountant", "contractor", "viewer"];
  return ["admin", "manager", "member", "accountant", "contractor", "viewer"];
}
