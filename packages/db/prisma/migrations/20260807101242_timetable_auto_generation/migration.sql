/*
  Warnings:

  - You are about to drop the column `endTime` on the `TimetableSlot` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `TimetableSlot` table. All the data in the column will be lost.
  - Added the required column `periodId` to the `TimetableSlot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roomId` to the `TimetableSlot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('GENERAL', 'LAB');

-- CreateEnum
CREATE TYPE "TimetableSlotSource" AS ENUM ('GENERATED', 'MANUAL');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "defaultRoomId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "maxPeriodsPerWeek" INTEGER,
ADD COLUMN     "periodsAvailableFrom" INTEGER,
ADD COLUMN     "periodsAvailableTo" INTEGER,
ADD COLUMN     "workingDays" "DayOfWeek"[];

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "periodsPerWeek" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "requiresLab" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roomId" TEXT;

-- AlterTable
ALTER TABLE "TimetableSlot" DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN     "periodId" TEXT NOT NULL,
ADD COLUMN     "roomId" TEXT NOT NULL,
ADD COLUMN     "source" "TimetableSlotSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'GENERAL',
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSubjectAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSubjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_schoolId_idx" ON "Room"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_schoolId_name_key" ON "Room"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Period_schoolId_idx" ON "Period"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Period_schoolId_periodNumber_key" ON "Period"("schoolId", "periodNumber");

-- CreateIndex
CREATE INDEX "TeacherSubjectAssignment_schoolId_idx" ON "TeacherSubjectAssignment"("schoolId");

-- CreateIndex
CREATE INDEX "TeacherSubjectAssignment_staffId_idx" ON "TeacherSubjectAssignment"("staffId");

-- CreateIndex
CREATE INDEX "TeacherSubjectAssignment_subjectId_idx" ON "TeacherSubjectAssignment"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSubjectAssignment_staffId_subjectId_key" ON "TeacherSubjectAssignment"("staffId", "subjectId");

-- CreateIndex
CREATE INDEX "TimetableSlot_roomId_dayOfWeek_idx" ON "TimetableSlot"("roomId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_defaultRoomId_fkey" FOREIGN KEY ("defaultRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectAssignment" ADD CONSTRAINT "TeacherSubjectAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubjectAssignment" ADD CONSTRAINT "TeacherSubjectAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
