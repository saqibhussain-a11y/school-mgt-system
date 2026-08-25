-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "examTermId" TEXT,
ADD COLUMN     "includePreviousTerms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marksDeadline" DATE,
ADD COLUMN     "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "ExamTerm" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamTerm_schoolId_idx" ON "ExamTerm"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamTerm_academicSessionId_order_key" ON "ExamTerm"("academicSessionId", "order");

-- CreateIndex
CREATE INDEX "Exam_examTermId_idx" ON "Exam"("examTermId");

-- AddForeignKey
ALTER TABLE "ExamTerm" ADD CONSTRAINT "ExamTerm_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_examTermId_fkey" FOREIGN KEY ("examTermId") REFERENCES "ExamTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
