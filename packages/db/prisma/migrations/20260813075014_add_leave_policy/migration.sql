-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sickDays" INTEGER NOT NULL DEFAULT 10,
    "casualDays" INTEGER NOT NULL DEFAULT 8,
    "otherDays" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_schoolId_key" ON "LeavePolicy"("schoolId");
