import { prisma } from "@sms/db";

export interface StaffAttendanceSettingsUpdate {
  officeLat?: number | null;
  officeLng?: number | null;
  radiusMeters?: number;
  checkInWindowStart?: string | null;
  checkInWindowEnd?: string | null;
  checkOutWindowStart?: string | null;
  checkOutWindowEnd?: string | null;
}

export const staffAttendanceSettingsService = {
  // Lazily upserted with schema defaults on first access — same pattern as
  // leavePolicy.service.ts. Unconfigured (nulls) means "no geofence to
  // compare against" / "no time restriction," not an error state.
  getOrCreate(schoolId: string) {
    return prisma.staffAttendanceSettings.upsert({
      where: { schoolId },
      create: { schoolId },
      update: {},
    });
  },

  update(schoolId: string, data: StaffAttendanceSettingsUpdate) {
    return prisma.staffAttendanceSettings.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
  },
};
