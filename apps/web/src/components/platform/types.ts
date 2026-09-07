export const SUBSCRIPTION_STATUSES = ["active", "past_due", "suspended"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// Mirrors apps/api/src/config/plans.ts's PLAN_KEYS — the 3 tiers are fixed
// in code, unlike their label/limits/price, which are DB-editable (see
// Plan below) via the Platform Admin Plans page.
export const PLAN_KEYS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export interface Plan {
  key: PlanKey;
  label: string;
  maxStudents: number;
  maxStaff: number;
  priceMonthly: number;
  updatedAt: string;
}

export interface PlatformSchool {
  id: string;
  name: string;
  subdomain: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionStatusChangedAt: string | null;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface SchoolUsage {
  studentCount: number;
  staffCount: number;
  classCount: number;
  lastActiveAt: string | null;
}

export interface PlatformAuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  createdAt: string;
  platformAdmin: { email: string; firstName: string; lastName: string };
}
