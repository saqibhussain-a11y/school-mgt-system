-- AlterTable
ALTER TABLE "PasswordResetOtp" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
