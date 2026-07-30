-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetRole" "Role",
    "targetClassId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_schoolId_idx" ON "Announcement"("schoolId");

-- CreateIndex
CREATE INDEX "Announcement_targetClassId_idx" ON "Announcement"("targetClassId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
