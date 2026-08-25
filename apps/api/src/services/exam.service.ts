import { prisma, type PrismaTransactionClient } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { gradeFor } from "../lib/grading";

type TxClient = PrismaTransactionClient;

export interface CreateExamInput {
  classId: string;
  academicSessionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  examSessionId?: string | null;
  examTermId?: string | null;
  marksDeadline?: Date | null;
  includePreviousTerms?: boolean;
  subjects: { subjectId: string; maxMarks: number }[];
}

// Proactive check ahead of the @@unique([examSessionId, classId]) DB
// constraint, purely for a clearer error message than the generic P2002
// mapping ("A record with these details already exists").
async function assertExamSessionValid(
  schoolId: string,
  examSessionId: string,
  classId: string,
  excludeExamId?: string,
) {
  const session = await prisma.examSession.findFirst({ where: { id: examSessionId, schoolId } });
  if (!session) throw new HttpError(400, "Exam session not found");

  const conflict = await prisma.exam.findFirst({
    where: { examSessionId, classId, ...(excludeExamId ? { id: { not: excludeExamId } } : {}) },
  });
  if (conflict) throw new HttpError(400, "This class is already part of that exam session");
}

const examInclude = {
  class: true,
  academicSession: true,
  // Nested `exams` (beyond the base scalar fields) exists so a session-linked
  // exam's datesheet page can disclose which sibling classes share this
  // session's dates, without a separate endpoint.
  examSession: { include: { exams: { select: { id: true, classId: true, class: { select: { name: true } } } } } },
  examTerm: true,
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

// Competition ranking (ties share a rank, the next rank skips ahead by the
// tie size — 1, 1, 3, 4) — the convention schools expect on a result sheet.
// A student with no marks entered at all (overallPercentage null) gets no
// rank rather than sorting to the bottom as if they scored zero.
function withRanks<T extends { overallPercentage: number | null }>(rows: T[]): (T & { rank: number | null })[] {
  const ranked = rows
    .map((row, index) => ({ row, index }))
    .filter((r) => r.row.overallPercentage !== null)
    .sort((a, b) => b.row.overallPercentage! - a.row.overallPercentage!);

  const rankByIndex = new Map<number, number>();
  let rank = 0;
  let seen = 0;
  let previousPercentage: number | null = null;
  for (const { row, index } of ranked) {
    seen += 1;
    if (row.overallPercentage !== previousPercentage) {
      rank = seen;
      previousPercentage = row.overallPercentage;
    }
    rankByIndex.set(index, rank);
  }

  return rows.map((row, index) => ({ ...row, rank: rankByIndex.get(index) ?? null }));
}

export const examService = {
  getExamSubjectContext(schoolId: string, examSubjectId: string) {
    return prisma.examSubject.findFirst({
      where: { id: examSubjectId, schoolId },
      include: { exam: true },
    });
  },

  list(schoolId: string, classId?: string, restrictToClassIds?: string[]) {
    return prisma.exam.findMany({
      where: {
        schoolId,
        ...(classId ? { classId } : restrictToClassIds ? { classId: { in: restrictToClassIds } } : {}),
      },
      include: examInclude,
      orderBy: { startDate: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.exam.findFirst({ where: { id, schoolId }, include: examInclude });
  },

  async create(schoolId: string, input: CreateExamInput) {
    if (input.examSessionId) {
      await assertExamSessionValid(schoolId, input.examSessionId, input.classId);
    }
    return prisma.$transaction(async (tx: TxClient) => {
      const exam = await tx.exam.create({
        data: {
          schoolId,
          classId: input.classId,
          academicSessionId: input.academicSessionId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          examSessionId: input.examSessionId ?? null,
          examTermId: input.examTermId ?? null,
          marksDeadline: input.marksDeadline ?? null,
          includePreviousTerms: input.includePreviousTerms ?? false,
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

  async update(
    schoolId: string,
    id: string,
    data: Partial<{
      name: string;
      startDate: Date;
      endDate: Date;
      examSessionId: string | null;
      examTermId: string | null;
      marksDeadline: Date | null;
      includePreviousTerms: boolean;
    }>,
  ) {
    const existing = await prisma.exam.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    if (data.examSessionId) {
      await assertExamSessionValid(schoolId, data.examSessionId, existing.classId, id);
    }
    return prisma.exam.update({ where: { id }, data, include: examInclude });
  },

  // Publishing/hiding only ever affects the STUDENT/PARENT-facing report
  // card read (see exam.route.ts) — TEACHER/SCHOOL_ADMIN/PRINCIPAL always
  // see raw marks regardless, so there's nothing else to gate here.
  async publish(schoolId: string, id: string) {
    const existing = await prisma.exam.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.exam.update({ where: { id }, data: { status: "PUBLISHED" }, include: examInclude });
  },

  async unpublish(schoolId: string, id: string) {
    const existing = await prisma.exam.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.exam.update({ where: { id }, data: { status: "DRAFT" }, include: examInclude });
  },

  // "142 of 150 expected marks entered" — same "a Mark row exists" notion
  // of entered/missing as getClassOverview's missingSubjects (a saved-blank
  // row counts as entered; only a genuinely absent row is missing), so this
  // reads consistently with what admins already see per-student.
  async getCompletenessSummary(schoolId: string, examId: string) {
    const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId }, include: { examSubjects: true } });
    if (!exam) throw new HttpError(404, "Exam not found");

    const [activeStudentCount, enteredCount] = await Promise.all([
      prisma.student.count({ where: { schoolId, classId: exam.classId, status: "ACTIVE" } }),
      prisma.mark.count({ where: { schoolId, examSubjectId: { in: exam.examSubjects.map((es) => es.id) } } }),
    ]);

    const expected = activeStudentCount * exam.examSubjects.length;
    return { expected, entered: Math.min(enteredCount, expected) };
  },

  // Feeds the admin dashboard's Needs Attention panel — same
  // "already-computed data, different lens" shape as its other sources
  // (leave/fee/library). Deliberately informational only: a passed
  // deadline never blocks marks entry, it just surfaces here.
  async listOverdueMarksEntry(schoolId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exams = await prisma.exam.findMany({
      where: { schoolId, marksDeadline: { lt: today } },
      include: { class: { select: { name: true } }, examSubjects: true },
    });
    if (exams.length === 0) return [];

    const overdue = await Promise.all(
      exams.map(async (exam) => {
        const [activeStudentCount, enteredCount] = await Promise.all([
          prisma.student.count({ where: { schoolId, classId: exam.classId, status: "ACTIVE" } }),
          prisma.mark.count({ where: { schoolId, examSubjectId: { in: exam.examSubjects.map((es) => es.id) } } }),
        ]);
        const expected = activeStudentCount * exam.examSubjects.length;
        return { exam, expected, entered: Math.min(enteredCount, expected) };
      }),
    );

    return overdue
      .filter(({ expected, entered }) => entered < expected)
      .map(({ exam, expected, entered }) => ({
        examId: exam.id,
        examName: exam.name,
        className: exam.class.name,
        marksDeadline: exam.marksDeadline!,
        expected,
        entered,
      }));
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

    // Side-by-side reference only (no weighted/combined score — see the
    // Exam.includePreviousTerms comment) — rows are always this exam's own
    // subject list; a prior term missing a subject just shows "—" for it.
    let previousTerms:
      | { termId: string; termName: string; examId: string; examName: string; subjects: { subjectId: string; percentage: number | null; grade: string | null }[] }[]
      | undefined;

    if (exam.examTermId && exam.includePreviousTerms && exam.examTerm) {
      const priorExams = await prisma.exam.findMany({
        where: {
          schoolId,
          classId: exam.classId,
          academicSessionId: exam.academicSessionId,
          examTerm: { order: { lt: exam.examTerm.order } },
        },
        include: { examTerm: true, examSubjects: { include: { subject: true } } },
        orderBy: { examTerm: { order: "asc" } },
      });

      if (priorExams.length > 0) {
        const priorMarks = await prisma.mark.findMany({
          where: {
            schoolId,
            studentId,
            examSubjectId: { in: priorExams.flatMap((e) => e.examSubjects.map((es) => es.id)) },
          },
        });
        const priorMarkByExamSubjectId = new Map(priorMarks.map((m) => [m.examSubjectId, m]));

        previousTerms = priorExams.map((priorExam) => ({
          termId: priorExam.examTerm!.id,
          termName: priorExam.examTerm!.name,
          examId: priorExam.id,
          examName: priorExam.name,
          subjects: subjects.map((s) => {
            const priorEs = priorExam.examSubjects.find((es) => es.subject.id === s.subjectId);
            if (!priorEs) return { subjectId: s.subjectId, percentage: null, grade: null };
            const mark = priorMarkByExamSubjectId.get(priorEs.id);
            const percentage =
              mark && !mark.isAbsent && mark.marksObtained !== null
                ? Math.round((mark.marksObtained / priorEs.maxMarks) * 10000) / 100
                : null;
            return { subjectId: s.subjectId, percentage, grade: percentage !== null ? gradeFor(percentage) : null };
          }),
        }));
      }
    }

    return { exam, subjects, overall, previousTerms };
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

  // Class-wide marks grid (every student x every subject) plus rank —
  // getClassOverview above only ever exposes missingSubjects + one rolled-up
  // percentage, never the actual per-subject marks. Reuses the same
  // per-subject percentage/grade math as getReportCard, just computed for
  // the whole class in one pass instead of one student at a time.
  async getClassResultSheet(schoolId: string, examId: string) {
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

    const rows = students.map((student) => {
      const studentMarks = marksByStudent.get(student.id) ?? [];
      const markByExamSubjectId = new Map(studentMarks.map((m) => [m.examSubjectId, m]));

      const subjectMarks = exam.examSubjects.map((es) => {
        const mark = markByExamSubjectId.get(es.id);
        const percentage =
          mark && !mark.isAbsent && mark.marksObtained !== null
            ? Math.round((mark.marksObtained / es.maxMarks) * 10000) / 100
            : null;
        return {
          subjectId: es.subject.id,
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

      return {
        studentId: student.id,
        admissionNo: student.admissionNo,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        subjectMarks,
        overallPercentage: overall.percentage,
        overallGrade: overall.grade,
      };
    });

    return {
      exam: { id: exam.id, name: exam.name, classId: exam.classId, className: exam.class.name },
      subjects: exam.examSubjects.map((es) => ({ subjectId: es.subject.id, subjectName: es.subject.name, maxMarks: es.maxMarks })),
      students: withRanks(rows),
    };
  },
};
