import { prisma, AttendanceStatus } from "@sms/db";
import { logger } from "../lib/logger";
import { queueEmails } from "../lib/queue";
import { attendanceAlertEmail } from "../lib/emailTemplates";
import { formatSchoolDate } from "../lib/schoolTime";
import { inAppNotificationService } from "./inAppNotification.service";

// Parents hear about the marks they'd want to act on. Present and Leave
// (leave is requested by the family itself) don't generate alerts unless
// they correct an earlier Absent/Half day.
const ALERT_STATUSES = new Set<AttendanceStatus>([AttendanceStatus.ABSENT, AttendanceStatus.HALF_DAY]);

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  LEAVE: "On leave",
};

export interface AttendanceChange {
  studentId: string;
  previous: AttendanceStatus | null;
  current: AttendanceStatus;
  remarks?: string | null;
}

export function alertsFor(changes: AttendanceChange[]) {
  return changes.filter(
    (c) =>
      c.previous !== c.current &&
      (ALERT_STATUSES.has(c.current) || (c.previous !== null && ALERT_STATUSES.has(c.previous))),
  );
}

function webUrl(path: string) {
  return `${process.env.WEB_APP_URL ?? "http://localhost:3000"}${path}`;
}

export const attendanceAlertService = {
  // Best-effort: attendance is already saved when this runs, so a failure
  // here is logged rather than surfaced as a failed save.
  async notifyParents(
    schoolId: string,
    input: { date: Date; sectionLabel: string; changes: AttendanceChange[] },
  ): Promise<number> {
    const alerts = alertsFor(input.changes);
    if (alerts.length === 0) return 0;

    try {
      const [school, students] = await Promise.all([
        prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true } }),
        prisma.student.findMany({
          where: { schoolId, id: { in: alerts.map((a) => a.studentId) } },
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
            guardians: {
              select: { guardian: { select: { user: { select: { id: true, email: true, firstName: true } } } } },
            },
          },
        }),
      ]);
      const studentById = new Map(students.map((s) => [s.id, s]));
      const dateLabel = formatSchoolDate(input.date);
      const link = "/dashboard/attendance";
      let parentsNotified = 0;
      const emails = [];

      for (const alert of alerts) {
        const student = studentById.get(alert.studentId);
        if (!student) continue;
        const parents = student.guardians.map((g) => g.guardian.user);
        if (parents.length === 0) continue;

        const studentName = `${student.user.firstName} ${student.user.lastName}`;
        const statusLabel = STATUS_LABELS[alert.current];
        const isCorrection = !ALERT_STATUSES.has(alert.current);

        await inAppNotificationService.notifyMany(
          schoolId,
          parents.map((p) => p.id),
          {
            type: "attendance",
            title: isCorrection
              ? `Attendance corrected: ${studentName} is ${statusLabel.toLowerCase()}`
              : `${studentName} was marked ${statusLabel.toLowerCase()}`,
            body: `${input.sectionLabel} · ${dateLabel}${alert.remarks ? ` · ${alert.remarks}` : ""}`,
            link,
          },
        );
        parentsNotified += parents.length;

        for (const parent of parents) {
          emails.push({
            to: parent.email,
            ...attendanceAlertEmail({
              parentFirstName: parent.firstName,
              studentName,
              statusLabel,
              isCorrection,
              dateLabel,
              sectionLabel: input.sectionLabel,
              remarks: alert.remarks,
              schoolName: school.name,
              link: webUrl(link),
            }),
          });
        }
      }

      await queueEmails(emails);
      return parentsNotified;
    } catch (err) {
      logger.error({ err, schoolId }, "Failed to send attendance alerts to parents");
      return 0;
    }
  },
};
