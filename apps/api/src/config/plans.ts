// A fixed, developer-maintained catalog rather than a DB table — plans are
// a business decision, not user-editable data. Limits/pricing here are
// placeholders, trivially adjusted in this one file.
export const PLAN_DEFINITIONS = {
  STARTER: { label: "Starter", maxStudents: 300, maxStaff: 30, priceMonthly: 49 },
  GROWTH: { label: "Growth", maxStudents: 1000, maxStaff: 100, priceMonthly: 149 },
  ENTERPRISE: { label: "Enterprise", maxStudents: 5000, maxStaff: 500, priceMonthly: 399 },
} as const;

export type PlanKey = keyof typeof PLAN_DEFINITIONS;

export const PLAN_KEYS = Object.keys(PLAN_DEFINITIONS) as [PlanKey, ...PlanKey[]];
