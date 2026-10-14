-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "studentId" TEXT,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "photoKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryAcknowledgment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "diaryEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiaryEntry_schoolId_idx" ON "DiaryEntry"("schoolId");

-- CreateIndex
CREATE INDEX "DiaryEntry_sectionId_date_idx" ON "DiaryEntry"("sectionId", "date");

-- CreateIndex
CREATE INDEX "DiaryEntry_studentId_idx" ON "DiaryEntry"("studentId");

-- CreateIndex
CREATE INDEX "DiaryAcknowledgment_schoolId_idx" ON "DiaryAcknowledgment"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "DiaryAcknowledgment_diaryEntryId_userId_key" ON "DiaryAcknowledgment"("diaryEntryId", "userId");

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryAcknowledgment" ADD CONSTRAINT "DiaryAcknowledgment_diaryEntryId_fkey" FOREIGN KEY ("diaryEntryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryAcknowledgment" ADD CONSTRAINT "DiaryAcknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
