import { prisma, runAsPlatform, StudentStatus, StaffStatus, type PrismaTransactionClient } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { platformAuditLogService } from "./platformAuditLog.service";

async function getSchoolPlan(tx: PrismaTransactionClient, schoolId: string) {
  const school = await tx.school.findUnique({ where: { id: schoolId }, select: { subscriptionPlan: true } });
  if (!school) return null;
  return tx.plan.findUnique({ where: { key: school.subscriptionPlan } });
}

export const planService = {
  list() {
    return runAsPlatform(() => prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } }));
  },

  async update(
    platformAdminId: string,
    key: string,
    data: Partial<{ label: string; maxStudents: number; maxStaff: number; priceMonthly: number }>,
  ) {
    return runAsPlatform(async () => {
      const existing = await prisma.plan.findUnique({ where: { key } });
      if (!existing) throw new HttpError(404, "Plan not found");

      return prisma.$transaction(async (tx) => {
        const updated = await tx.plan.update({ where: { key }, data });
        await platformAuditLogService.record(tx, {
          platformAdminId,
          action: "plan.update",
          targetType: "Plan",
          targetId: key,
          metadata: { from: existing, to: data },
        });
        return updated;
      });
    });
  },

  // Called from inside student/staff create transactions (tenant-side, not
  // platform-side) — a school on an unrecognized/missing plan key isn't
  // blocked here, same "don't fail on a data gap" stance as elsewhere in
  // this service layer; that's a data-integrity problem for Platform Admin
  // to notice separately, not something that should lock a school out of
  // admitting students.
  async assertSeatAvailable(
    tx: PrismaTransactionClient,
    schoolId: string,
    kind: "student" | "staff",
    additionalCount: number,
  ) {
    const plan = await getSchoolPlan(tx, schoolId);
    if (!plan) return;

    const limit = kind === "student" ? plan.maxStudents : plan.maxStaff;
    const currentCount =
      kind === "student"
        ? await tx.student.count({ where: { schoolId, status: StudentStatus.ACTIVE } })
        : await tx.staff.count({ where: { schoolId, status: StaffStatus.ACTIVE } });

    if (currentCount + additionalCount <= limit) return;

    const noun = kind === "student" ? "student" : "staff member";
    const nounPlural = kind === "student" ? "students" : "staff members";
    const room = Math.max(0, limit - currentCount);
    const roomClause =
      additionalCount > 1
        ? `only ${room} more can be added (you're adding ${additionalCount})`
        : "no more can be added";

    throw new HttpError(
      403,
      `This school is on the ${plan.label} plan (${limit} max ${
        limit === 1 ? noun : nounPlural
      }) and already has ${currentCount} active ${
        currentCount === 1 ? noun : nounPlural
      } — ${roomClause}. Upgrade the school's plan to add more.`,
      "PLAN_LIMIT_REACHED",
    );
  },
};
