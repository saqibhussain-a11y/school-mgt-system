import { z } from "zod";
import { Role } from "@sms/db";

const STAFF_ROLES = [
  Role.TEACHER,
  Role.PRINCIPAL,
  Role.ACCOUNTANT,
  Role.LIBRARIAN,
  Role.TRANSPORT_MANAGER,
] as const;

export const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(Role).refine((r) => STAFF_ROLES.includes(r as (typeof STAFF_ROLES)[number]), {
    message: `role must be one of ${STAFF_ROLES.join(", ")}`,
  }),
  designation: z.string().min(1),
  joiningDate: z.coerce.date().optional(),
});

export const updateStaffSchema = z.object({
  designation: z.string().min(1),
});

export const assignTeacherSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
});
