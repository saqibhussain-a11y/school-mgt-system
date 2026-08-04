import { z } from "zod";

export const createSchoolSchema = z.object({
  name: z.string().min(1),
  subdomain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase letters, numbers, and hyphens only"),
  adminEmail: z.string().email(),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
});

export const SUBSCRIPTION_STATUSES = ["active", "past_due", "suspended"] as const;

export const updateSubscriptionSchema = z.object({
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).optional(),
  subscriptionPlan: z.string().min(1).optional(),
});
