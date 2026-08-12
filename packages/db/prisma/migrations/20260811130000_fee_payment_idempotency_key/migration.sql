-- AlterTable
ALTER TABLE "FeePayment" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_schoolId_idempotencyKey_key" ON "FeePayment"("schoolId", "idempotencyKey");
