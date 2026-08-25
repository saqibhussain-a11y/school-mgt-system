import { randomUUID } from "crypto";
import { prisma, type PrismaTransactionClient, Role, StudentStatus } from "@sms/db";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";
import { generateOtp } from "../lib/otp";
import { HttpError } from "../middleware/errorHandler";
import { creditPoolFor, roundMoney } from "../lib/feeLedger";
import { admissionNumberFormatService } from "./admissionNumberFormat.service";
import { passwordResetService } from "./passwordReset.service";

type TxClient = PrismaTransactionClient;

export interface CreateStudentInput {
  email: string;
  firstName: string;
  lastName: string;
  // Left undefined for a normal admission where the admin accepts the
  // suggested next number from admissionNumberFormatService — explicitly
  // supplied for a manual override, or when migrating numbers from a
  // school's existing records via bulk import.
  admissionNo?: string;
  classId: string;
  sectionId: string;
  dob: Date;
  admissionDate?: Date;
  previousSchool?: string;
  medicalInfo?: string;
  // Free-form bulk-import columns that didn't map to a known field.
  extraInfo?: Record<string, string>;
}

const studentInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, isActivated: true } },
  class: true,
  section: true,
  guardians: {
    include: {
      guardian: {
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  },
};

// list() has no consumer that reads .guardians (roster/dropdown views only
// need name/class/section) — the 3-level guardian.guardian.user nest was
// pure over-fetch on every roster load, worst-case the whole school's
// students at once when no classId/sectionId filter is applied.
const studentListInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, isActivated: true } },
  class: true,
  section: true,
};

// Not real pagination (no consumer's UI paginates) — just a backstop so an
// unfiltered list on a school with a pathologically large roster can't
// return an unbounded payload. Comfortably above any real school's size.
const LIST_SAFETY_CAP = 2000;

async function createOne(tx: TxClient, schoolId: string, input: CreateStudentInput) {
  let admissionNo = input.admissionNo;
  if (admissionNo) {
    await admissionNumberFormatService.advanceIfNeeded(tx, schoolId, admissionNo);
  } else {
    admissionNo = await admissionNumberFormatService.consumeNext(tx, schoolId);
  }

  // No usable password at admission time — portal access is a separate,
  // explicitly-triggered action (see generateCredentialsAdminSet/Invite
  // below). A random, never-disclosed hash avoids a schema change
  // (passwordHash stays non-null) while being unguessable and unable to
  // verify against anything a real login attempt would type.
  const passwordHash = await hashPassword(randomUUID());

  const user = await tx.user.create({
    data: {
      schoolId,
      email: input.email,
      passwordHash,
      isActivated: false,
      role: Role.STUDENT,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  return tx.student.create({
    data: {
      schoolId,
      userId: user.id,
      admissionNo,
      classId: input.classId,
      sectionId: input.sectionId,
      dob: input.dob,
      admissionDate: input.admissionDate,
      previousSchool: input.previousSchool,
      medicalInfo: input.medicalInfo,
      extraInfo: input.extraInfo,
    },
    include: studentInclude,
  });
}

export const studentService = {
  list(
    schoolId: string,
    filters: { classId?: string; sectionId?: string; sectionIdIn?: string[] } = {},
  ) {
    const { sectionIdIn, ...rest } = filters;
    return prisma.student.findMany({
      where: { schoolId, ...rest, ...(sectionIdIn ? { sectionId: { in: sectionIdIn } } : {}) },
      include: studentListInclude,
      orderBy: { admissionNo: "asc" },
      take: LIST_SAFETY_CAP,
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.student.findFirst({ where: { id, schoolId }, include: studentInclude });
  },

  create(schoolId: string, input: CreateStudentInput) {
    return prisma.$transaction((tx) => createOne(tx, schoolId, input));
  },

  // All-or-nothing: one row failing (e.g. a duplicate email/admissionNo)
  // rolls back the whole batch — master doc Section 8.10.
  bulkCreate(schoolId: string, inputs: CreateStudentInput[]) {
    return prisma.$transaction(async (tx) => {
      const created = [];
      for (const input of inputs) {
        created.push(await createOne(tx, schoolId, input));
      }
      return created;
    });
  },

  async update(
    schoolId: string,
    id: string,
    data: Partial<{
      classId: string;
      sectionId: string;
      previousSchool: string | null;
      medicalInfo: string | null;
    }>,
  ) {
    const existing = await prisma.student.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.student.update({ where: { id }, data, include: studentInclude });
  },

  async withdraw(schoolId: string, id: string) {
    const existing = await prisma.student.findFirst({ where: { id, schoolId } });
    if (!existing) return null;

    // Withdrawing leaves no invoice to ever apply outstanding fee credit
    // to, and no automatic refund path — block rather than silently
    // stranding it as an invisible liability.
    const invoices = await prisma.feeInvoice.findMany({
      where: { schoolId, studentId: id },
      select: { netAmount: true, payments: { select: { amountPaid: true, paymentMethod: true, refunds: { select: { amount: true } } } } },
    });
    const creditBalance = Math.max(0, creditPoolFor(invoices));
    if (creditBalance > 0) {
      throw new HttpError(
        400,
        `This student has ${roundMoney(creditBalance)} of unapplied fee credit — apply it to an invoice or account for it before withdrawing`,
      );
    }

    return prisma.student.update({
      where: { id },
      data: { status: StudentStatus.WITHDRAWN },
    });
  },

  async isOwnStudent(schoolId: string, userId: string, studentId: string) {
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId, userId } });
    return student !== null;
  },

  async getOwnClassId(schoolId: string, userId: string) {
    const student = await prisma.student.findFirst({
      where: { schoolId, userId },
      select: { classId: true },
    });
    return student?.classId ?? null;
  },

  getByUserId(schoolId: string, userId: string) {
    return prisma.student.findFirst({ where: { schoolId, userId } });
  },

  async listActiveByClass(schoolId: string, classId: string) {
    return prisma.student.findMany({
      where: { schoolId, classId, status: StudentStatus.ACTIVE },
      select: { id: true, userId: true },
    });
  },

  // "Admin sets it" mode — issues a temporary password directly, same
  // mechanism as the existing generic reset-password action, just usable
  // for a student who has never had credentials at all yet (not only a
  // password change for an already-active account).
  async generateCredentialsAdminSet(schoolId: string, studentId: string) {
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, include: studentInclude });
    if (!student) return null;
    const password = generateTempPassword();
    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: student.userId }, data: { passwordHash, isActivated: true } });
    return { email: student.user.email, firstName: student.user.firstName, password };
  },

  // "Student sets their own" mode — an OTP-based invite reusing the exact
  // same mechanism as forgot-password (passwordResetService + POST
  // /auth/reset-password); isActivated only flips true once the student
  // actually claims it (see userService.updatePassword), not at send time.
  async generateCredentialsInvite(schoolId: string, studentId: string) {
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, include: studentInclude });
    if (!student) return null;
    const otp = generateOtp();
    await passwordResetService.create(schoolId, student.userId, otp);
    return { email: student.user.email, firstName: student.user.firstName, otp };
  },
};
