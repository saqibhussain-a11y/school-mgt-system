-- AlterTable
ALTER TABLE "School" ADD COLUMN     "subscriptionStatusChangedAt" TIMESTAMP(3),
ALTER COLUMN "subscriptionPlan" SET DEFAULT 'STARTER';

-- Remap the old free-text default to the new fixed plan catalog (STARTER/
-- GROWTH/ENTERPRISE) introduced alongside this migration.
UPDATE "School" SET "subscriptionPlan" = 'STARTER' WHERE "subscriptionPlan" = 'single_tenant';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAuditLog_platformAdminId_idx" ON "PlatformAuditLog"("platformAdminId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_targetType_targetId_idx" ON "PlatformAuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
