/*
  Warnings:

  - Added the required column `schoolId` to the `PayslipAdjustment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PayslipAdjustment" ADD COLUMN     "schoolId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "PayslipAdjustment_schoolId_idx" ON "PayslipAdjustment"("schoolId");
