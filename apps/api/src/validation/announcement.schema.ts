import { z } from "zod";
import { Role } from "@sms/db";

export const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  targetRole: z.nativeEnum(Role).optional(),
  targetClassId: z.string().min(1).optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  targetRole: z.nativeEnum(Role).nullable().optional(),
  targetClassId: z.string().min(1).nullable().optional(),
});
