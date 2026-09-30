import { Role } from "@sms/db";

// Optional feature modules a school can be opted into by Platform Admin
// (School.enabledModules, PATCH /api/platform/schools/:id/modules). Fixed
// set — adding one needs code changes (routes gated by requireModule(),
// validation, frontend label), same convention as PLAN_KEYS in plans.ts.
export const MODULE_KEYS = ["PAYROLL", "LIBRARY", "TRANSPORT"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  PAYROLL: "Payroll",
  LIBRARY: "Library",
  TRANSPORT: "Transport",
};

// The widest a module is ever allowed to be for a given role — mirrors each
// module's nav item `roles` in apps/web/src/lib/nav-config.ts exactly (kept
// as a second source of truth deliberately, not imported cross-app: this is
// the enforcement copy, that one is display-only). A school's
// moduleRoleOverrides can only narrow this list, never widen it — see
// requireModuleRoleAccess() in lib/modules.ts.
export const MODULE_CEILING_ROLES: Record<ModuleKey, Role[]> = {
  PAYROLL: [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER, Role.ACCOUNTANT, Role.LIBRARIAN, Role.TRANSPORT_MANAGER],
  LIBRARY: [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.LIBRARIAN, Role.STUDENT, Role.PARENT],
  TRANSPORT: [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TRANSPORT_MANAGER, Role.STUDENT, Role.PARENT],
};
