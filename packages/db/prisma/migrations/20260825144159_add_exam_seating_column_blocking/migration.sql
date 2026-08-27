-- CreateEnum
CREATE TYPE "SeatingStrategy" AS ENUM ('INTERLEAVED', 'COLUMN_BLOCKED');

-- DropIndex
DROP INDEX "ExamSeatAllocation_examSessionId_roomId_seatNumber_key";

-- AlterTable
ALTER TABLE "ExamSeatAllocation" ADD COLUMN     "columnId" TEXT;

-- AlterTable
ALTER TABLE "ExamSession" ADD COLUMN     "seatingStrategy" "SeatingStrategy" NOT NULL DEFAULT 'INTERLEAVED';

-- CreateTable
CREATE TABLE "RoomColumn" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "columnNumber" INTEGER NOT NULL,
    "seatCapacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomColumn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomColumn_schoolId_idx" ON "RoomColumn"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomColumn_roomId_columnNumber_key" ON "RoomColumn"("roomId", "columnNumber");

-- CreateIndex
CREATE INDEX "ExamSeatAllocation_columnId_idx" ON "ExamSeatAllocation"("columnId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatAllocation_examSessionId_roomId_columnId_seatNumber_key" ON "ExamSeatAllocation"("examSessionId", "roomId", "columnId", "seatNumber");

-- AddForeignKey
ALTER TABLE "RoomColumn" ADD CONSTRAINT "RoomColumn_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAllocation" ADD CONSTRAINT "ExamSeatAllocation_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "RoomColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

