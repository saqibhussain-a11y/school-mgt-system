import { z } from "zod";
import { Role } from "@sms/db";

export const loginSchema = z.object({
  schoolId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

// Super-admin-only sign-in — no schoolId, since there is exactly one
// super admin system-wide and it's looked up by email alone.
export const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// Only ever creates a SCHOOL_ADMIN — SUPER_ADMIN's one remaining creation
// right. Every other role has its own dedicated endpoint (/api/staff,
// /api/students, /api/guardians) that also creates the matching profile row,
// so this schema deliberately doesn't accept an arbitrary role.
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.literal(Role.SCHOOL_ADMIN),
});

export const forgotPasswordSchema = z.object({
  schoolId: z.string().min(1),
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  schoolId: z.string().min(1),
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
