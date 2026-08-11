import { prisma, AttendanceStatus } from "@sms/db";
import { gradeFor } from "../lib/grading";
import { ledgerFor, roundMoney } from "../lib/feeLedger";

const STATUS_WEIGHT: Record<AttendanceStatus, number> = {
  PRESENT: 1,
  HALF_DAY: 0.5,
  ABSENT: 0,
  LEAVE: 0,
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export const reportsService = {
  async getSchoolName(schoolId: string) {
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    return school.name;
  },


  // One point per calendar day in range — the day-by-day attendance % trend
  // used for a line chart. Excludes nothing else special (holidays simply
  // have no Attendance rows, so they don't appear as a data point at all).
  async attendanceTrend(schoolId: string, filters: { classId?: string; from: Date; to: Date }) {
    const records = await prisma.attendance.findMany({
      where: {
        schoolId,
        ...(filters.classId ? { classId: filters.classId } : {}),
        date: { gte: filters.from, lte: filters.to },
      },
      select: { date: true, status: true },
    });

    const byDate = new Map<string, AttendanceStatus[]>();
    for (const r of records) {
      const key = toDateKey(r.date);
      const list = byDate.get(key) ?? [];
      list.push(r.status);
      byDate.set(key, list);
    }

    return [...byDate.entries()]
      .map(([date, statuses]) => {
        const totalMarked = statuses.length;
        const presentEquivalent = statuses.reduce((sum, s) => sum + STATUS_WEIGHT[s], 0);
        const percentage = totalMarked > 0 ? Math.round((presentEquivalent / totalMarked) * 10000) / 100 : 0;
        return { date, percentage, totalMarked };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  // One point per exam, in chronological order — each student's overall
  // percentage across that exam's subjects (same totalObtained/totalMax math
  // as a report card), averaged across every student who has at least one
  // graded mark for it. Exams with zero marks entered yet are omitted, not
  // shown as a misleading 0%.
  async performanceTrend(schoolId: string, filters: { classId?: string } = {}) {
    const exams = await prisma.exam.findMany({
      where: { schoolId, ...(filters.classId ? { classId: filters.classId } : {}) },
      include: { examSubjects: true },
      orderBy: { startDate: "asc" },
    });

    const results = [];
    for (const exam of exams) {
      const examSubjectIds = exam.examSubjects.map((es) => es.id);
      const maxMarksByExamSubject = new Map(exam.examSubjects.map((es) => [es.id, es.maxMarks]));
      const marks = await prisma.mark.findMany({
        where: { schoolId, examSubjectId: { in: examSubjectIds }, isAbsent: false, marksObtained: { not: null } },
        select: { studentId: true, examSubjectId: true, marksObtained: true },
      });
      if (marks.length === 0) continue;

      const byStudent = new Map<string, { obtained: number; max: number }>();
      for (const m of marks) {
        const maxMarks = maxMarksByExamSubject.get(m.examSubjectId) ?? 0;
        const entry = byStudent.get(m.studentId) ?? { obtained: 0, max: 0 };
        entry.obtained += m.marksObtained ?? 0;
        entry.max += maxMarks;
        byStudent.set(m.studentId, entry);
      }

      const percentages = [...byStudent.values()]
        .filter((e) => e.max > 0)
        .map((e) => (e.obtained / e.max) * 100);
      const averagePercentage = Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 100) / 100;

      results.push({
        examId: exam.id,
        examName: exam.name,
        startDate: toDateKey(exam.startDate),
        averagePercentage,
        averageGrade: gradeFor(averagePercentage),
        studentCount: percentages.length,
      });
    }
    return results;
  },

  // One point per calendar month (bucketed by invoice due date, not the
  // free-form `period` label, since that's arbitrary text an accountant
  // typed and can't be relied on to sort chronologically).
  async feeCollectionTrend(schoolId: string, filters: { classId?: string } = {}) {
    const invoices = await prisma.feeInvoice.findMany({
      where: { schoolId, ...(filters.classId ? { feeStructure: { classId: filters.classId } } : {}) },
      include: { payments: { include: { refunds: true } } },
    });

    const byMonth = new Map<string, { invoiced: number; collected: number; outstanding: number }>();
    for (const invoice of invoices) {
      const key = monthKey(invoice.dueDate);
      const { effectivePaid, balance } = ledgerFor(invoice);
      const bucket = byMonth.get(key) ?? { invoiced: 0, collected: 0, outstanding: 0 };
      bucket.invoiced += invoice.netAmount;
      // Capped at netAmount — unapplied credit is a deferred liability, not
      // collected revenue (see feeInvoice.service.ts's summary() for the
      // same fix applied to the school-wide totals).
      bucket.collected += Math.min(effectivePaid, invoice.netAmount);
      bucket.outstanding += balance;
      byMonth.set(key, bucket);
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, bucket]) => ({
        month: monthLabel(key),
        totalInvoiced: roundMoney(bucket.invoiced),
        totalCollected: roundMoney(bucket.collected),
        totalOutstanding: roundMoney(bucket.outstanding),
      }));
  },
};
