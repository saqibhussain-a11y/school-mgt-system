// Optional feature modules a school can be opted into by Platform Admin
// (School.enabledModules, PATCH /api/platform/schools/:id/modules). Fixed
// set — adding one needs code changes (routes gated by requireModule(),
// validation, frontend label), same convention as PLAN_KEYS in plans.ts.
export const MODULE_KEYS = ["PAYROLL"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  PAYROLL: "Payroll",
};
