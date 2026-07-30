import { prisma, Prisma, Role, StudentStatus } from "@sms/db";
import { hashPassword } from "../lib/password";

type TxClient = Prisma.TransactionClient;

export interface CreateStudentInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  classId: string;
  sectionId: string;
  dob: Date;
  admissionDate?: Date;
  previousSchool?: string;
  medicalInfo?: string;
}

const studentInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
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

async function createOne(tx: TxClient, schoolId: string, input: CreateStudentInput) {
  const passwordHash = await hashPassword(input.password);

  const user = await tx.user.create({
    data: {
      schoolId,
      email: input.email,
      passwordHash,
      role: Role.STUDENT,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  return tx.student.create({
    data: {
      schoolId,
      userId: user.id,
      admissionNo: input.admissionNo,
      classId: input.classId,
      sectionId: input.sectionId,
      dob: input.dob,
      admissionDate: input.admissionDate,
      previousSchool: input.previousSchool,
      medicalInfo: input.medicalInfo,
    },
    include: studentInclude,
  });
}

export const studentService = {
  list(schoolId: string, filters: { classId?: string; sectionId?: string } = {}) {
    return prisma.student.findMany({
      where: { schoolId, ...filters },
      include: studentInclude,
      orderBy: { admissionNo: "asc" },
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
};
