export const SUBSCRIPTION_STATUSES = ["active", "past_due", "suspended"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// Mirrors apps/api/src/config/plans.ts's PLAN_DEFINITIONS keys/labels.
export const PLAN_LABELS = {
  STARTER: "Starter",
  GROWTH: "Growth",
  ENTERPRISE: "Enterprise",
} as const;
export type PlanKey = keyof typeof PLAN_LABELS;

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
