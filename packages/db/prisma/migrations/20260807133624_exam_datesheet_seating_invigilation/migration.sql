-- CreateEnum
CREATE TYPE "ExamAssignmentSource" AS ENUM ('GENERATED', 'MANUAL');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "examSessionId" TEXT;

-- AlterTable
ALTER TABLE "ExamSubject" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "examDate" DATE,
ADD COLUMN     "startTime" TEXT;

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isAutoCreated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSeatAllocation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "source" "ExamAssignmentSource" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamInvigilation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examSessionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "examDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "source" "ExamAssignmentSource" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamInvigilation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSession_schoolId_idx" ON "ExamSession"("schoolId");

-- CreateIndex
CREATE INDEX "ExamSession_academicSessionId_idx" ON "ExamSession"("academicSessionId");

-- CreateIndex
CREATE INDEX "ExamSeatAllocation_schoolId_idx" ON "ExamSeatAllocation"("schoolId");

-- CreateIndex
CREATE INDEX "ExamSeatAllocation_roomId_idx" ON "ExamSeatAllocation"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatAllocation_examSessionId_studentId_key" ON "ExamSeatAllocation"("examSessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatAllocation_examSessionId_roomId_seatNumber_key" ON "ExamSeatAllocation"("examSessionId", "roomId", "seatNumber");

-- CreateIndex
CREATE INDEX "ExamInvigilation_schoolId_idx" ON "ExamInvigilation"("schoolId");

-- CreateIndex
CREATE INDEX "ExamInvigilation_staffId_examDate_idx" ON "ExamInvigilation"("staffId", "examDate");

-- CreateIndex
CREATE INDEX "ExamInvigilation_roomId_examDate_idx" ON "ExamInvigilation"("roomId", "examDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExamInvigilation_examSessionId_roomId_examDate_startTime_en_key" ON "ExamInvigilation"("examSessionId", "roomId", "examDate", "startTime", "endTime", "staffId");

-- CreateIndex
CREATE INDEX "Exam_examSessionId_idx" ON "Exam"("examSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Exam_examSessionId_classId_key" ON "Exam"("examSessionId", "classId");

-- CreateIndex
CREATE INDEX "ExamSubject_schoolId_examDate_idx" ON "ExamSubject"("schoolId", "examDate");

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "ExamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAllocation" ADD CONSTRAINT "ExamSeatAllocation_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAllocation" ADD CONSTRAINT "ExamSeatAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAllocation" ADD CONSTRAINT "ExamSeatAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamInvigilation" ADD CONSTRAINT "ExamInvigilation_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "ExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamInvigilation" ADD CONSTRAINT "ExamInvigilation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamInvigilation" ADD CONSTRAINT "ExamInvigilation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

