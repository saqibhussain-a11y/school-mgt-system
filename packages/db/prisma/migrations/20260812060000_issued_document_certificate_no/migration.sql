-- AlterTable
ALTER TABLE "IssuedDocument" ADD COLUMN "certificateNo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "IssuedDocument_schoolId_certificateNo_key" ON "IssuedDocument"("schoolId", "certificateNo");
