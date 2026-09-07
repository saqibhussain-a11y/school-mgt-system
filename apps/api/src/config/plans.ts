// Fixed set of plan tiers a school can be assigned to — NOT user-editable
// (adding/removing a tier needs code changes: routes, validation, frontend).
// Each tier's label/limits/price ARE editable via Platform Admin — see the
// Plan model and planService, seeded from these same 3 keys.
export const PLAN_KEYS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
