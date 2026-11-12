-- AlterTable
ALTER TABLE "School" ADD COLUMN     "workingDays" "DayOfWeek"[] DEFAULT ARRAY['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']::"DayOfWeek"[];

-- AlterTable
ALTER TABLE "StaffAttendance" ADD COLUMN     "checkOutReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StaffAttendanceSettings" ADD COLUMN     "blockOutsideRadius" BOOLEAN NOT NULL DEFAULT false;

-- Starter plan targets small local schools.
UPDATE "Plan" SET "maxStudents" = 100, "maxStaff" = 10, "updatedAt" = NOW() WHERE "key" = 'STARTER';
