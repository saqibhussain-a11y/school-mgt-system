-- CreateTable
CREATE TABLE "Syllabus" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Syllabus_schoolId_idx" ON "Syllabus"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Syllabus_classId_subjectId_academicSessionId_key" ON "Syllabus"("classId", "subjectId", "academicSessionId");

-- CreateIndex
CREATE INDEX "Chapter_schoolId_idx" ON "Chapter"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_syllabusId_order_key" ON "Chapter"("syllabusId", "order");

-- CreateIndex
CREATE INDEX "ScheduleEntry_schoolId_idx" ON "ScheduleEntry"("schoolId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_chapterId_idx" ON "ScheduleEntry"("chapterId");

-- AddForeignKey
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Syllabus" ADD CONSTRAINT "Syllabus_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "Syllabus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
