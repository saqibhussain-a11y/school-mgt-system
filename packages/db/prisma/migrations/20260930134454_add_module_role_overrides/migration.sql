-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "canCustomizeModuleRoles" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "moduleRoleOverrides" JSONB;
