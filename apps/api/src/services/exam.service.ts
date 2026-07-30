import { prisma, Prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { gradeFor } from "../lib/grading";

type TxClient = Prisma.TransactionClient;

export interface CreateExamInput {
  classId: string;
  academicSessionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  subjects: { subjectId: string; maxMarks: number }[];
}

const examInclude = {
  class: true,
  academicSession: true,
  examSubjects: { include: { subject: true } },
};

interface MarkRecord {
  studentId: string;
  marksObtained: number | null;
  isAbsent: boolean;
}

// null when nothing's been entered yet (distinct from a real 0%) — every
// caller (report card, class overview) needs to render "not yet available"
// rather than a misleading score.
function overallFor(entries: { marksObtained: number | null; isAbsent: boolean; maxMarks: number }[]) {
  const graded = entries.filter((e) => !e.isAbsent && e.marksObtained !== null);
  if (graded.length === 0) return { percentage: null as number | null, grade: null as string | null };
  const totalObtained = graded.reduce((sum, e) => sum + (e.marksObtained ?? 0), 0);
  const totalMax = graded.reduce((sum, e) => sum + e.maxMarks, 0);
  const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 10000) / 100 : 0;
  return { percentage, grade: gradeFor(percentage) };
}

export const examService = {
  getExamSubjectContext(schoolId: string, examSubjectId: string) {
    return prisma.examSubject.findFirst({
      where: { id: examSubjectId, schoolId },
      include: { exam: true },
    });
  },

  list(schoolId: string, classId?: string) {
    return prisma.exam.findMany({
      where: { schoolId, ...(classId ? { classId } : {}) },
      include: examInclude,
      orderBy: { startDate: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.exam.findFirst({ where: { id, schoolId }, include: examInclude });
  },

  async create(schoolId: string, input: CreateExamInput) {
    return prisma.$transaction(async (tx: TxClient) => {
      const exam = await tx.exam.create({
        data: {
          schoolId,
          classId: input.classId,
          academicSessionId: input.academicSessionId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      });
      await tx.examSubject.createMany({
        data: input.subjects.map((s) => ({
          schoolId,
          examId: exam.id,
          subjectId: s.subjectId,
          maxMarks: s.maxMarks,
        })),
      });
      return tx.exam.findUniqueOrThrow({ where: { id: exam.id }, include: examInclude });
    });
  },

  async update(schoolId: string, id: string, data: Partial<{ name: string; startDate: Date; endDate: Date }>) {
    const existing = await prisma.exam.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.exam.update({ where: { id }, data, include: examInclude });
  },

  async remove(schoolId: string, id: string) {
    const exam = await prisma.exam.findFirst({ where: { id, schoolId }, include: { examSubjects: true } });
    if (!exam) return null;

    const markCount = await prisma.mark.count({
      where: { examSubjectId: { in: exam.examSubjects.map((es) => es.id) } },
    });
    if (markCount > 0) {
      throw new HttpError(400, "Cannot delete an exam that already has marks entered");
    }

    await prisma.$transaction([
      prisma.examSubject.deleteMany({ where: { examId: id } }),
      prisma.exam.delete({ where: { id } }),
    ]);
    return exam;
  },

  async getMarksSheet(schoolId: string, examSubjectId: string) {
    const examSubject = await prisma.examSubject.findFirst({
      where: { id: examSubjectId, schoolId },
      include: { exam: true, subject: true },
    });
    if (!examSubject) throw new HttpError(404, "Exam subject not found");

    const [students, marks] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId, classId: examSubject.exam.classId, status: "ACTIVE" },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { admissionNo: "asc" },
      }),
      prisma.mark.findMany({ where: { schoolId, examSubjectId } }),
    ]);

    const marksByStudent = new Map(marks.map((m) => [m.studentId, m]));
    return {
      examSubject,
      students: students.map((s) => {
        const mark = marksByStudent.get(s.id);
        return {
          studentId: s.id,
          admissionNo: s.admissionNo,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          marksObtained: mark?.marksObtained ?? null,
          isAbsent: mark?.isAbsent ?? false,
        };
      }),
    };
  },

  async saveMarksBulk(
    schoolId: string,
    examSubjectId: string,
    records: MarkRecord[],
    enteredByUserId: string,
  ) {
    const examSubject = await prisma.examSubject.findFirst({
      where: { id: examSubjectId, schoolId },
      include: { exam: true },
    });
    if (!examSubject) throw new HttpError(404, "Exam subject not found");

    const studentIds = records.map((r) => r.studentId);
    const validStudents = await prisma.student.findMany({
      where: { id: { in: studentIds }, schoolId, classId: examSubject.exam.classId },
      select: { id: true },
    });
    const validIds = new Set(validStudents.map((s) => s.id));
    const invalid = studentIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new HttpError(400, `These students are not in this exam's class: ${invalid.join(", ")}`);
    }

    return prisma.$transaction(
      records.map((record) =>
        prisma.mark.upsert({
          where: { examSubjectId_studentId: { examSubjectId, studentId: record.studentId } },
          create: {
            schoolId,
            examSubjectId,
            studentId: record.studentId,
            marksObtained: record.isAbsent ? null : record.marksObtained,
            isAbsent: record.isAbsent,
            enteredByUserId,
          },
          update: {
            marksObtained: record.isAbsent ? null : record.marksObtained,
            isAbsent: record.isAbsent,
            enteredByUserId,
          },
        }),
      ),
    );
  },

  async getReportCard(schoolId: string, examId: string, studentId: string) {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
      include: examInclude,
    });
    if (!exam) throw new HttpError(404, "Exam not found");

    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
    if (!student || student.classId !== exam.classId) {
      throw new HttpError(404, "This student is not in this exam's class");
    }

    const marks = await prisma.mark.findMany({
      where: { schoolId, studentId, examSubjectId: { in: exam.examSubjects.map((es) => es.id) } },
    });
    const markByExamSubjectId = new Map(marks.map((m) => [m.examSubjectId, m]));

    const subjects = exam.examSubjects.map((es) => {
      const mark = markByExamSubjectId.get(es.id);
      const percentage =
        mark && !mark.isAbsent && mark.marksObtained !== null
          ? Math.round((mark.marksObtained / es.maxMarks) * 10000) / 100
          : null;
      return {
        subjectId: es.subject.id,
        subjectName: es.subject.name,
        maxMarks: es.maxMarks,
        marksObtained: mark?.marksObtained ?? null,
        isAbsent: mark?.isAbsent ?? false,
        percentage,
        grade: percentage !== null ? gradeFor(percentage) : null,
      };
    });

    const overall = overallFor(
      exam.examSubjects.map((es) => {
        const mark = markByExamSubjectId.get(es.id);
        return {
          marksObtained: mark?.marksObtained ?? null,
          isAbsent: mark?.isAbsent ?? false,
          maxMarks: es.maxMarks,
        };
      }),
    );

    return { exam, subjects, overall };
  },

  async getClassOverview(schoolId: string, examId: string) {
    const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId }, include: examInclude });
    if (!exam) throw new HttpError(404, "Exam not found");

    const [students, marks] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId, classId: exam.classId, status: "ACTIVE" },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { admissionNo: "asc" },
      }),
      prisma.mark.findMany({
        where: { schoolId, examSubjectId: { in: exam.examSubjects.map((es) => es.id) } },
      }),
    ]);

    const marksByStudent = new Map<string, typeof marks>();
    for (const mark of marks) {
      const list = marksByStudent.get(mark.studentId) ?? [];
      list.push(mark);
      marksByStudent.set(mark.studentId, list);
    }

    return students.map((student) => {
      const studentMarks = marksByStudent.get(student.id) ?? [];
      const markByExamSubjectId = new Map(studentMarks.map((m) => [m.examSubjectId, m]));
      const missingSubjects = exam.examSubjects
        .filter((es) => !markByExamSubjectId.has(es.id))
        .map((es) => es.subject.name);
      const overall = overallFor(
        exam.examSubjects.map((es) => {
          const mark = markByExamSubjectId.get(es.id);
          return {
            marksObtained: mark?.marksObtained ?? null,
            isAbsent: mark?.isAbsent ?? false,
            maxMarks: es.maxMarks,
          };
        }),
      );
      return {
        studentId: student.id,
        admissionNo: student.admissionNo,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        missingSubjects,
        overallPercentage: overall.percentage,
        overallGrade: overall.grade,
      };
    });
  },
};
