import { z } from "zod";
import { Role } from "@sms/db";

export const loginSchema = z.object({
  schoolId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const registerSchema = z.object({
  schoolId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
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
