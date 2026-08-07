import { z } from "zod";
import { Role, DayOfWeek } from "@sms/db";

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

// Timetable-generation inputs — flat weekly values, see Staff model comment.
export const updateAvailabilitySchema = z
  .object({
    workingDays: z.array(z.nativeEnum(DayOfWeek)).default([]),
    periodsAvailableFrom: z.number().int().positive().nullable().optional(),
    periodsAvailableTo: z.number().int().positive().nullable().optional(),
    maxPeriodsPerWeek: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) =>
      !data.periodsAvailableFrom ||
      !data.periodsAvailableTo ||
      data.periodsAvailableTo >= data.periodsAvailableFrom,
    { message: "periodsAvailableTo must be >= periodsAvailableFrom", path: ["periodsAvailableTo"] },
  );

export const bulkSubjectAssignmentSchema = z.object({
  subjectIds: z.array(z.string().min(1)).min(1),
});
