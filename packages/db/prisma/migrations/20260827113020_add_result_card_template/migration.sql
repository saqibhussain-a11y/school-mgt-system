-- CreateTable
CREATE TABLE "ResultCardTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "imageFilename" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultCardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResultCardTemplate_schoolId_key" ON "ResultCardTemplate"("schoolId");

-- CreateIndex
CREATE INDEX "ResultCardTemplate_schoolId_idx" ON "ResultCardTemplate"("schoolId");
