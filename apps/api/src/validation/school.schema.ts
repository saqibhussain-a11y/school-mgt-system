import { z } from "zod";
import { PLAN_KEYS } from "../config/plans";
import { MODULE_KEYS } from "../config/modules";

const CREDENTIAL_MODES = ["ADMIN_SET", "SELF_SERVICE"] as const;

export const createSchoolSchema = z.object({
  name: z.string().min(1),
  subdomain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase letters, numbers, and hyphens only"),
  adminEmail: z.string().email(),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
  subscriptionPlan: z.enum(PLAN_KEYS).optional(),
  mode: z.enum(CREDENTIAL_MODES),
});

export const SUBSCRIPTION_STATUSES = ["active", "past_due", "suspended"] as const;

export const updateSubscriptionSchema = z.object({
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).optional(),
  subscriptionPlan: z.enum(PLAN_KEYS).optional(),
});

export const createSchoolAdminSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mode: z.enum(CREDENTIAL_MODES),
});

export const updateSchoolModulesSchema = z.object({
  enabledModules: z.array(z.enum(MODULE_KEYS)),
});
