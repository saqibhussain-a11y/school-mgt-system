-- AlterTable
ALTER TABLE "School" ADD COLUMN     "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
