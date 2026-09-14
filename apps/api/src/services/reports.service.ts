import { prisma, AttendanceStatus } from "@sms/db";
import { gradeFor } from "../lib/grading";
import { ledgerFor, roundMoney } from "../lib/feeLedger";
import { getLlmProvider } from "../lib/llm";

export type ReportSummaryType = "attendance" | "performance" | "fees" | "at-risk";

const SUMMARY_SYSTEM_PROMPT =
  "You summarize school analytics data for a school administrator. Write 3-5 concise, plain-language " +
  "sentences — no markdown, no bullet points, no headings. State only facts present in the JSON data " +
  "given to you; never invent a number that isn't there. Call out whatever is most worth the reader's " +
  "attention: the clearest trend, the biggest outlier, or the most actionable point.";

const REPORT_DESCRIPTIONS: Record<ReportSummaryType, string> = {
  attendance: "Daily attendance percentage over a date range, one point per day with the percentage and how many students were marked.",
  performance: "Exam-over-exam average performance percentage across a class's exams, in chronological order.",
  fees: "Monthly fee totals: amount invoiced, amount collected, and amount still outstanding.",
  "at-risk":
    "Students currently flagged as at-risk, with the specific reason(s) for each — low attendance and/or a declining or failing exam trend.",
};

const STATUS_WEIGHT: Record<AttendanceStatus, number> = {
  PRESENT: 1,
  HALF_DAY: 0.5,
  ABSENT: 0,
  LEAVE: 0,
};

// At-risk thresholds — heuristic defaults, not derived from the master doc
// (this scenario wasn't in it). Tune here if a school's real usage shows
// these are too noisy or too quiet.
const ATTENDANCE_WINDOW_DAYS = 30;
const LOW_ATTENDANCE_THRESHOLD = 75;
const EXAM_DECLINE_THRESHOLD = 10;
const FAILING_THRESHOLD = 40;

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

    // One query across every exam's subjects, not one query per exam — this
    // used to fire a sequential prisma.mark.findMany inside the exam loop,
    // so a school with N exams made N+1 round-trips for one chart.
    const allExamSubjectIds = exams.flatMap((exam) => exam.examSubjects.map((es) => es.id));
    const marks =
      allExamSubjectIds.length > 0
        ? await prisma.mark.findMany({
            where: { schoolId, examSubjectId: { in: allExamSubjectIds }, isAbsent: false, marksObtained: { not: null } },
            select: { studentId: true, examSubjectId: true, marksObtained: true },
          })
        : [];

    const marksByExamSubject = new Map<string, typeof marks>();
    for (const m of marks) {
      const list = marksByExamSubject.get(m.examSubjectId) ?? [];
      list.push(m);
      marksByExamSubject.set(m.examSubjectId, list);
    }

    const results = [];
    for (const exam of exams) {
      const maxMarksByExamSubject = new Map(exam.examSubjects.map((es) => [es.id, es.maxMarks]));
      const examMarks = exam.examSubjects.flatMap((es) => marksByExamSubject.get(es.id) ?? []);
      if (examMarks.length === 0) continue;

      const byStudent = new Map<string, { obtained: number; max: number }>();
      for (const m of examMarks) {
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

  // Two independent leading indicators, not one blended score — a school
  // would otherwise only notice either at report-card time. Reasons are
  // additive (a student can trip both, or neither); a single averaged
  // number would hide which lever actually needs pulling.
  async atRiskStudents(schoolId: string, filters: { classId?: string } = {}) {
    const since = new Date(Date.now() - ATTENDANCE_WINDOW_DAYS * 86_400_000);

    const students = await prisma.student.findMany({
      where: { schoolId, status: "ACTIVE", ...(filters.classId ? { classId: filters.classId } : {}) },
      include: {
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    if (students.length === 0) return [];
    const studentIds = students.map((s) => s.id);

    const [attendanceRows, marks] = await Promise.all([
      prisma.attendance.findMany({
        where: { schoolId, studentId: { in: studentIds }, date: { gte: since } },
        select: { studentId: true, status: true },
      }),
      prisma.mark.findMany({
        where: { schoolId, studentId: { in: studentIds }, isAbsent: false, marksObtained: { not: null } },
        select: {
          studentId: true,
          marksObtained: true,
          examSubject: { select: { examId: true, maxMarks: true, exam: { select: { startDate: true } } } },
        },
      }),
    ]);

    const attendanceByStudent = new Map<string, AttendanceStatus[]>();
    for (const r of attendanceRows) {
      const list = attendanceByStudent.get(r.studentId) ?? [];
      list.push(r.status);
      attendanceByStudent.set(r.studentId, list);
    }

    // Per student, per exam totals first, collapsed to one percentage per
    // exam afterward — the same totalObtained/totalMax shape performanceTrend
    // uses above, just kept separate per student instead of averaged across
    // the class.
    const examTotalsByStudent = new Map<string, Map<string, { obtained: number; max: number; startDate: Date }>>();
    for (const m of marks) {
      const examId = m.examSubject.examId;
      const perExam = examTotalsByStudent.get(m.studentId) ?? new Map();
      const entry = perExam.get(examId) ?? { obtained: 0, max: 0, startDate: m.examSubject.exam.startDate };
      entry.obtained += m.marksObtained ?? 0;
      entry.max += m.examSubject.maxMarks;
      perExam.set(examId, entry);
      examTotalsByStudent.set(m.studentId, perExam);
    }

    const results: {
      studentId: string;
      firstName: string;
      lastName: string;
      className: string;
      sectionName: string;
      reasons: string[];
      attendancePercentage: number | null;
      latestExamPercentage: number | null;
    }[] = [];

    for (const student of students) {
      const reasons: string[] = [];

      const statuses = attendanceByStudent.get(student.id) ?? [];
      let attendancePercentage: number | null = null;
      if (statuses.length > 0) {
        const presentEquivalent = statuses.reduce((sum, s) => sum + STATUS_WEIGHT[s], 0);
        attendancePercentage = Math.round((presentEquivalent / statuses.length) * 10000) / 100;
        if (attendancePercentage < LOW_ATTENDANCE_THRESHOLD) {
          reasons.push(`Attendance is ${attendancePercentage}% over the last ${ATTENDANCE_WINDOW_DAYS} days`);
        }
      }

      const examPercentages = [...(examTotalsByStudent.get(student.id)?.values() ?? [])]
        .filter((e) => e.max > 0)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
        .map((e) => Math.round((e.obtained / e.max) * 10000) / 100);

      let latestExamPercentage: number | null = null;
      if (examPercentages.length > 0) {
        latestExamPercentage = examPercentages[examPercentages.length - 1];
        let flaggedExamDecline = false;
        if (examPercentages.length >= 2) {
          const previous = examPercentages[examPercentages.length - 2];
          if (previous - latestExamPercentage >= EXAM_DECLINE_THRESHOLD) {
            reasons.push(`Exam average dropped from ${previous}% to ${latestExamPercentage}%`);
            flaggedExamDecline = true;
          }
        }
        if (!flaggedExamDecline && latestExamPercentage < FAILING_THRESHOLD) {
          reasons.push(`Latest exam average is ${latestExamPercentage}%`);
        }
      }

      if (reasons.length === 0) continue;

      results.push({
        studentId: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        className: student.class.name,
        sectionName: student.section.name,
        reasons,
        attendancePercentage,
        latestExamPercentage,
      });
    }

    // Most reasons first (trouble on both fronts outranks either alone),
    // worst attendance as the tiebreaker.
    return results.sort((a, b) => {
      if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
      return (a.attendancePercentage ?? 100) - (b.attendancePercentage ?? 100);
    });
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

  // Reuses whichever *Trend/atRiskStudents method above already answers
  // this report — no separate data path, so the summary can never disagree
  // with the chart/table sitting right next to it.
  async summarize(
    schoolId: string,
    type: ReportSummaryType,
    filters: { classId?: string; from?: Date; to?: Date } = {},
  ) {
    const data =
      type === "attendance"
        ? await this.attendanceTrend(schoolId, {
            classId: filters.classId,
            from: filters.from ?? new Date(Date.now() - 30 * 86_400_000),
            to: filters.to ?? new Date(),
          })
        : type === "performance"
          ? await this.performanceTrend(schoolId, { classId: filters.classId })
          : type === "fees"
            ? await this.feeCollectionTrend(schoolId, { classId: filters.classId })
            : await this.atRiskStudents(schoolId, { classId: filters.classId });

    if (Array.isArray(data) && data.length === 0) {
      return "There isn't enough data yet to summarize this report.";
    }

    const provider = getLlmProvider();
    const reply = await provider.chat([
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${REPORT_DESCRIPTIONS[type]}\n\nData (JSON):\n${JSON.stringify(data).slice(0, 8000)}`,
      },
    ]);
    return reply.trim();
  },
};
