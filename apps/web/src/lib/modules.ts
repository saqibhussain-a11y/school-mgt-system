// Mirrors apps/api/src/config/modules.ts's MODULE_KEYS — used here only to
// render an enabled/disabled label on the school's own Settings page, not
// to gate anything (there's no Payroll feature yet to gate).
export const MODULE_KEYS = ["PAYROLL"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const MODULE_LABELS: Record<ModuleKey, string> = {
  PAYROLL: "Payroll",
};
