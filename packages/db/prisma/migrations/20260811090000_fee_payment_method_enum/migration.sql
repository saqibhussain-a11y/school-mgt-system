-- CreateEnum
CREATE TYPE "FeePaymentMethod" AS ENUM ('MANUAL', 'CREDIT');

-- AlterTable: cast existing free-form values (all "manual" today) rather than
-- drop-and-recreate the column, so a value this migration wasn't written to
-- expect fails loudly instead of silently defaulting.
ALTER TABLE "FeePayment" ALTER COLUMN "paymentMethod" DROP DEFAULT;
ALTER TABLE "FeePayment" ALTER COLUMN "paymentMethod" TYPE "FeePaymentMethod" USING (UPPER("paymentMethod")::"FeePaymentMethod");
ALTER TABLE "FeePayment" ALTER COLUMN "paymentMethod" SET DEFAULT 'MANUAL';
