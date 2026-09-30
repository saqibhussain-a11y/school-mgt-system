import { randomUUID } from "crypto";
import { prisma, type PrismaTransactionClient, Role, StudentStatus } from "@sms/db";
import { hashPassword } from "../lib/password";
import { generateTempPassword } from "../lib/tempPassword";
import { generateOtp } from "../lib/otp";
import { HttpError } from "../middleware/errorHandler";
import { creditPoolFor, roundMoney } from "../lib/feeLedger";
import { admissionNumberFormatService } from "./admissionNumberFormat.service";
import { passwordResetService } from "./passwordReset.service";
import { planService } from "./plan.service";
import { skipTake, type PaginationParams, type Paginated } from "../lib/pagination";
import { bulkImportRowSchema } from "../validation/student.schema";

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

// No usable password at admission time — portal access is a separate,
// explicitly-triggered action (see generateCredentialsAdminSet/Invite
// below). A random, never-disclosed hash avoids a schema change
// (passwordHash stays non-null) while being unguessable and unable to
// verify against anything a real login attempt would type. Since it's
// never disclosed or checked against anything, the same hash is safe to
// reuse across an entire bulk-import batch — see bulkCreate below, which
// hashes once instead of once per row to keep bcrypt's ~10-round cost out
// of the interactive transaction (caught live: a 150-row import blew
// Prisma's 5s default transaction timeout on bcrypt cost alone).
function unusablePlaceholderHash() {
  return hashPassword(randomUUID());
}

async function createOne(tx: TxClient, schoolId: string, input: CreateStudentInput, passwordHash: string) {
  let admissionNo = input.admissionNo;
  if (admissionNo) {
    await admissionNumberFormatService.advanceIfNeeded(tx, schoolId, admissionNo);
  } else {
    admissionNo = await admissionNumberFormatService.consumeNext(tx, schoolId);
  }

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

export type BulkImportRowError = { row: number; message: string };

export interface BulkImportResolution {
  inputs: CreateStudentInput[];
  errors: BulkImportRowError[];
}

type ClassSectionCache = Map<string, { classId: string; sectionId: string } | null>;

// Resolves a human-typed class/section name pair (bulk-import CSVs can't be
// expected to know our internal cuids) to real IDs, case-insensitively.
// Cached per-import batch (see resolveBulkImportRows) since the same
// class/section pair typically repeats across many rows in one file.
async function resolveClassSection(schoolId: string, cache: ClassSectionCache, className: string, sectionName: string) {
  const key = `${className.toLowerCase()}::${sectionName.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;
  const cls = await prisma.class.findFirst({
    where: { schoolId, name: { equals: className, mode: "insensitive" } },
  });
  const section = cls
    ? await prisma.section.findFirst({
        where: { schoolId, classId: cls.id, name: { equals: sectionName, mode: "insensitive" } },
      })
    : null;
  const resolved = cls && section ? { classId: cls.id, sectionId: section.id } : null;
  cache.set(key, resolved);
  return resolved;
}

type StudentListFilters = { classId?: string; sectionId?: string; sectionIdIn?: string[]; search?: string };

function studentListWhere(schoolId: string, filters: StudentListFilters) {
  const { sectionIdIn, search, ...rest } = filters;
  return {
    schoolId,
    ...rest,
    ...(sectionIdIn ? { sectionId: { in: sectionIdIn } } : {}),
    ...(search
      ? {
          OR: [
            { admissionNo: { contains: search, mode: "insensitive" as const } },
            { user: { firstName: { contains: search, mode: "insensitive" as const } } },
            { user: { lastName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

export const studentService = {
  list(schoolId: string, filters: StudentListFilters = {}) {
    return prisma.student.findMany({
      where: studentListWhere(schoolId, filters),
      include: studentListInclude,
      orderBy: { admissionNo: "asc" },
      take: LIST_SAFETY_CAP,
    });
  },

  // Same filters as list(), a distinct method rather than an optional 3rd
  // param — see staff/guardian/feeInvoice.service.ts's identical split —
  // so every existing list() call site (dropdowns, class rosters, etc.)
  // keeps its original flat-array return type with zero change, and a
  // table page opts into the { data, total } envelope by name.
  async listPaginated(schoolId: string, filters: StudentListFilters, pagination: PaginationParams) {
    const where = studentListWhere(schoolId, filters);
    const [data, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: studentListInclude,
        orderBy: { admissionNo: "asc" },
        ...skipTake(pagination, LIST_SAFETY_CAP),
      }),
      prisma.student.count({ where }),
    ]);
    return { data, total, page: pagination.page, pageSize: pagination.pageSize } satisfies Paginated<(typeof data)[number]>;
  },

  getById(schoolId: string, id: string) {
    return prisma.student.findFirst({ where: { id, schoolId }, include: studentInclude });
  },

  async create(schoolId: string, input: CreateStudentInput) {
    const passwordHash = await unusablePlaceholderHash();
    return prisma.$transaction(async (tx) => {
      await planService.assertSeatAvailable(tx, schoolId, "student", 1);
      return createOne(tx, schoolId, input, passwordHash);
    });
  },

  // All-or-nothing: one row failing (e.g. a duplicate email/admissionNo)
  // rolls back the whole batch — master doc Section 8.10. The seat check is
  // for the whole batch up front too, so a bulk import doesn't partially
  // succeed up to the plan limit then fail confusingly on one row.
  //
  // Hashed once, outside the transaction, and reused for every row (see
  // unusablePlaceholderHash) — bcrypt's cost per row is what made this time
  // out on realistically-sized imports. The explicit timeout/maxWait below
  // is a second safety margin on top of that fix, for batches large enough
  // that even cheap sequential row inserts add up (a few thousand rows).
  bulkCreate(schoolId: string, inputs: CreateStudentInput[]) {
    return prisma.$transaction(
      async (tx) => {
        const passwordHash = await unusablePlaceholderHash();
        await planService.assertSeatAvailable(tx, schoolId, "student", inputs.length);
        const created = [];
        for (const input of inputs) {
          created.push(await createOne(tx, schoolId, input, passwordHash));
        }
        return created;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  },

  // Maps raw CSV rows (as columns:true parsing yields them) through the
  // admin-chosen header->field mapping, validates each row against
  // bulkImportRowSchema, and resolves className/sectionName to real IDs.
  // Row-level failures are collected rather than thrown so the route can
  // report every bad row in one response instead of failing on the first.
  async resolveBulkImportRows(
    schoolId: string,
    rows: Record<string, string>[],
    mapping: Record<string, string | null>,
  ): Promise<BulkImportResolution> {
    const errors: BulkImportRowError[] = [];
    const inputs: CreateStudentInput[] = [];
    const classSectionCache: ClassSectionCache = new Map();

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2; // +1 for header, +1 for 1-based row numbers
      const mapped: Record<string, string> = {};
      const extraInfo: Record<string, string> = {};
      for (const [header, value] of Object.entries(row)) {
        const target = mapping[header];
        if (target) mapped[target] = value;
        else if (value) extraInfo[header] = value;
      }
      if (mapped.admissionNo !== undefined) {
        const trimmed = mapped.admissionNo.trim();
        if (trimmed) mapped.admissionNo = trimmed;
        else delete mapped.admissionNo;
      }

      const result = bulkImportRowSchema.safeParse(mapped);
      if (!result.success) {
        errors.push({ row: rowNumber, message: result.error.issues.map((i) => i.message).join(", ") });
        continue;
      }

      const resolved = await resolveClassSection(schoolId, classSectionCache, result.data.className, result.data.sectionName);
      if (!resolved) {
        errors.push({
          row: rowNumber,
          message: `Class "${result.data.className}" / section "${result.data.sectionName}" not found`,
        });
        continue;
      }

      inputs.push({
        email: result.data.email,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        admissionNo: result.data.admissionNo,
        classId: resolved.classId,
        sectionId: resolved.sectionId,
        dob: result.data.dob,
        previousSchool: result.data.previousSchool,
        medicalInfo: result.data.medicalInfo,
        extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
      });
    }

    return { inputs, errors };
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
