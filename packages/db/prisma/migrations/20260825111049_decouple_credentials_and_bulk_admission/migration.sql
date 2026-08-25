-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "extraInfo" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActivated" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AdmissionNumberFormat" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'ADM-',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "padWidth" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionNumberFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentImportMapping" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionNumberFormat_schoolId_key" ON "AdmissionNumberFormat"("schoolId");

-- CreateIndex
CREATE INDEX "AdmissionNumberFormat_schoolId_idx" ON "AdmissionNumberFormat"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentImportMapping_schoolId_key" ON "StudentImportMapping"("schoolId");

-- CreateIndex
CREATE INDEX "StudentImportMapping_schoolId_idx" ON "StudentImportMapping"("schoolId");
