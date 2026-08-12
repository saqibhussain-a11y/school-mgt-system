import { Router } from "express";
import { Role } from "@sms/db";
import { reportsService } from "../services/reports.service";
import { getAssignedClassIdsForUser } from "../services/teacherAssignment.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { HttpError } from "../middleware/errorHandler";
import { toCsv } from "../lib/csv";
import { generateReportPdf } from "../lib/reportPdf";
import { getOrSet } from "../lib/cache";
import { FEE_MANAGE_ROLES } from "./feeStructure.route";

// Short TTL, not event-based invalidation — these trend charts recompute
// from attendance/marks/fee tables that change throughout the day, but a
// dashboard chart being up to a minute stale is an acceptable trade for not
// scattering cache-invalidation calls across every write path that touches
// attendance, marks, or fee payments.
const REPORT_CACHE_TTL_SECONDS = 60;

const ACADEMIC_REPORT_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER];

// A TEACHER may only pull reports for a class they're actually assigned to —
// same class-scoping rule used everywhere else a teacher touches
// cross-student data (Exams, Assignments). Admins/principals are unrestricted.
async function resolveClassIdForAcademicReport(schoolId: string, user: { sub: string; role: string }, requestedClassId?: string) {
  if (user.role !== Role.TEACHER) return requestedClassId;
  const assignedClassIds = await getAssignedClassIdsForUser(schoolId, user.sub);
  if (!requestedClassId) {
    throw new HttpError(400, "Select one of your assigned classes to view this report");
  }
  if (!assignedClassIds.includes(requestedClassId)) {
    throw new HttpError(403, "You are not assigned to this class");
  }
  return requestedClassId;
}

async function respond(
  req: import("express").Request,
  res: import("express").Response,
  schoolId: string,
  reportTitle: string,
  columns: { key: string; label: string; width: number }[],
  rows: Record<string, unknown>[],
) {
  const format = (req.query.format as string) ?? "json";
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${reportTitle.toLowerCase().replace(/\s+/g, "-")}.csv"`);
    res.send(toCsv(columns, rows));
    return;
  }
  if (format === "pdf") {
    const schoolName = await reportsService.getSchoolName(schoolId);
    const pdf = await generateReportPdf(schoolName, reportTitle, columns, rows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportTitle.toLowerCase().replace(/\s+/g, "-")}.pdf"`);
    res.send(pdf);
    return;
  }
  res.json(rows);
}

export const reportsRouter = Router();
reportsRouter.use(authenticate);

reportsRouter.get("/attendance-trend", authorize(...ACADEMIC_REPORT_ROLES), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const classId = await resolveClassIdForAcademicReport(schoolId, req.user!, req.query.classId as string | undefined);
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 86_400_000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const cacheKey = `reports:attendance-trend:${schoolId}:${classId ?? "all"}:${from.toISOString()}:${to.toISOString()}`;
    const rows = await getOrSet(cacheKey, REPORT_CACHE_TTL_SECONDS, () =>
      reportsService.attendanceTrend(schoolId, { classId, from, to }),
    );
    await respond(req, res, schoolId, "Attendance trend", [
      { key: "date", label: "Date", width: 150 },
      { key: "percentage", label: "Attendance %", width: 150 },
      { key: "totalMarked", label: "Students marked", width: 150 },
    ], rows);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/performance-trend", authorize(...ACADEMIC_REPORT_ROLES), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const classId = await resolveClassIdForAcademicReport(schoolId, req.user!, req.query.classId as string | undefined);
    const cacheKey = `reports:performance-trend:${schoolId}:${classId ?? "all"}`;
    const rows = await getOrSet(cacheKey, REPORT_CACHE_TTL_SECONDS, () =>
      reportsService.performanceTrend(schoolId, { classId }),
    );
    await respond(req, res, schoolId, "Performance trend", [
      { key: "examName", label: "Exam", width: 180 },
      { key: "startDate", label: "Start date", width: 110 },
      { key: "averagePercentage", label: "Average %", width: 90 },
      { key: "averageGrade", label: "Grade", width: 70 },
      { key: "studentCount", label: "Students", width: 90 },
    ], rows);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/fee-collection-trend", authorize(...FEE_MANAGE_ROLES), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const classId = req.query.classId as string | undefined;
    const cacheKey = `reports:fee-collection-trend:${schoolId}:${classId ?? "all"}`;
    const rows = await getOrSet(cacheKey, REPORT_CACHE_TTL_SECONDS, () =>
      reportsService.feeCollectionTrend(schoolId, { classId }),
    );
    await respond(req, res, schoolId, "Fee collection trend", [
      { key: "month", label: "Month", width: 110 },
      { key: "totalInvoiced", label: "Invoiced", width: 110 },
      { key: "totalCollected", label: "Collected", width: 110 },
      { key: "totalOutstanding", label: "Outstanding", width: 110 },
    ], rows);
  } catch (err) {
    next(err);
  }
});
