// Mirrors apps/api/src/config/modules.ts's MODULE_KEYS — used to render the
// Settings -> Feature Modules tab (enabled/disabled label, and, when the
// school's plan allows it, the per-role access editor).
export const MODULE_KEYS = ["PAYROLL", "LIBRARY", "TRANSPORT"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const MODULE_LABELS: Record<ModuleKey, string> = {
  PAYROLL: "Payroll",
  LIBRARY: "Library",
  TRANSPORT: "Transport",
};
