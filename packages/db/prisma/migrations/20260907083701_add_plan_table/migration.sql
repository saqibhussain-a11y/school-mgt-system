-- CreateTable
CREATE TABLE "Plan" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxStudents" INTEGER NOT NULL,
    "maxStaff" INTEGER NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("key")
);

-- Seed the 3 tiers with the exact values that used to live in
-- apps/api/src/config/plans.ts, so this migration is behavior-preserving.
INSERT INTO "Plan" ("key", "label", "maxStudents", "maxStaff", "priceMonthly", "updatedAt") VALUES
    ('STARTER', 'Starter', 300, 30, 49, CURRENT_TIMESTAMP),
    ('GROWTH', 'Growth', 1000, 100, 149, CURRENT_TIMESTAMP),
    ('ENTERPRISE', 'Enterprise', 5000, 500, 399, CURRENT_TIMESTAMP);
