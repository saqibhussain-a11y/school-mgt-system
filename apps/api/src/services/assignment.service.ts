import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { gradeFor } from "../lib/grading";
import { putObject, getDownloadUrl, deleteObject } from "../lib/storage";
import { studentService } from "./student.service";
import { studentGuardianService } from "./studentGuardian.service";
import { inAppNotificationService } from "./inAppNotification.service";

export interface CreateAssignmentInput {
  classId: string;
  subjectId: string;
  title: string;
  description?: string;
  dueDate: Date;
  maxMarks?: number;
  createdByUserId: string;
}

const assignmentInclude = {
  class: true,
  subject: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function scoreFor(marksObtained: number | null, maxMarks: number) {
  if (marksObtained === null) return { percentage: null, grade: null };
  const percentage = Math.round((marksObtained / maxMarks) * 10000) / 100;
  return { percentage, grade: gradeFor(percentage) };
}

export const assignmentService = {
  list(schoolId: string, classId?: string) {
    return prisma.assignment.findMany({
      where: { schoolId, ...(classId ? { classId } : {}) },
      include: assignmentInclude,
      orderBy: { dueDate: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.assignment.findFirst({ where: { id, schoolId }, include: assignmentInclude });
  },

  async create(schoolId: string, input: CreateAssignmentInput) {
    const assignment = await prisma.assignment.create({
      data: { schoolId, maxMarks: input.maxMarks ?? 100, ...input },
      include: assignmentInclude,
    });

    const students = await studentService.listActiveByClass(schoolId, input.classId);
    const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(
      schoolId,
      students.map((s) => s.id),
    );
    await inAppNotificationService.notifyMany(
      schoolId,
      [...students.map((s) => s.userId), ...parentUserIds],
      { type: "assignment", title: "New assignment", body: assignment.title, link: `/dashboard/assignments/${assignment.id}` },
    );

    return assignment;
  },

  async update(
    schoolId: string,
    id: string,
    data: Partial<{ title: string; description: string | null; dueDate: Date; maxMarks: number }>,
  ) {
    const existing = await prisma.assignment.findFirst({ where: { id, schoolId } });
    if (!existing) return null;
    return prisma.assignment.update({ where: { id }, data, include: assignmentInclude });
  },

  async remove(schoolId: string, id: string) {
    const existing = await prisma.assignment.findFirst({
      where: { id, schoolId },
      include: { submissions: true },
    });
    if (!existing) return null;

    await Promise.allSettled([
      existing.attachmentKey ? deleteObject(existing.attachmentKey) : Promise.resolve(),
      ...existing.submissions.map((s) => (s.fileKey ? deleteObject(s.fileKey) : Promise.resolve())),
    ]);

    await prisma.$transaction([
      prisma.submission.deleteMany({ where: { assignmentId: id } }),
      prisma.assignment.delete({ where: { id } }),
    ]);
    return existing;
  },

  async setAttachment(schoolId: string, id: string, file: { buffer: Buffer; filename: string; contentType: string }) {
    const existing = await prisma.assignment.findFirst({ where: { id, schoolId } });
    if (!existing) throw new HttpError(404, "Assignment not found");

    const key = `schools/${schoolId}/assignments/${id}/${Date.now()}-${sanitizeFilename(file.filename)}`;
    await putObject(key, file.buffer, file.contentType);
    if (existing.attachmentKey) await deleteObject(existing.attachmentKey).catch(() => {});

    return prisma.assignment.update({
      where: { id },
      data: { attachmentKey: key, attachmentFilename: file.filename },
      include: assignmentInclude,
    });
  },

  async getAttachmentDownloadUrl(schoolId: string, id: string) {
    const assignment = await prisma.assignment.findFirst({ where: { id, schoolId } });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (!assignment.attachmentKey) throw new HttpError(404, "This assignment has no attachment");
    return getDownloadUrl(assignment.attachmentKey);
  },

  async getSubmissionForStudent(schoolId: string, assignmentId: string, studentId: string) {
    const submission = await prisma.submission.findFirst({
      where: { schoolId, assignmentId, studentId },
    });
    if (!submission) return null;
    const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, schoolId } });
    return { ...submission, ...scoreFor(submission.marksObtained, assignment!.maxMarks) };
  },

  async listSubmissions(schoolId: string, assignmentId: string) {
    const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, schoolId } });
    if (!assignment) throw new HttpError(404, "Assignment not found");

    const [students, submissions] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId, classId: assignment.classId, status: "ACTIVE" },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { admissionNo: "asc" },
      }),
      prisma.submission.findMany({ where: { schoolId, assignmentId } }),
    ]);

    const submissionByStudent = new Map(submissions.map((s) => [s.studentId, s]));
    return students.map((student) => {
      const submission = submissionByStudent.get(student.id);
      const score = scoreFor(submission?.marksObtained ?? null, assignment.maxMarks);
      return {
        studentId: student.id,
        admissionNo: student.admissionNo,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        submitted: Boolean(submission),
        submittedAt: submission?.submittedAt ?? null,
        isLate: submission ? submission.submittedAt > assignment.dueDate : false,
        marksObtained: submission?.marksObtained ?? null,
        feedback: submission?.feedback ?? null,
        ...score,
      };
    });
  },

  async upsertSubmission(
    schoolId: string,
    assignmentId: string,
    studentId: string,
    data: { textAnswer?: string; file?: { buffer: Buffer; filename: string; contentType: string } },
  ) {
    const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, schoolId } });
    if (!assignment) throw new HttpError(404, "Assignment not found");

    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
    if (!student || student.classId !== assignment.classId) {
      throw new HttpError(400, "This student is not in this assignment's class");
    }

    let fileKey: string | undefined;
    let fileFilename: string | undefined;
    if (data.file) {
      const existing = await prisma.submission.findFirst({ where: { schoolId, assignmentId, studentId } });
      fileKey = `schools/${schoolId}/assignments/${assignmentId}/submissions/${studentId}/${Date.now()}-${sanitizeFilename(data.file.filename)}`;
      await putObject(fileKey, data.file.buffer, data.file.contentType);
      if (existing?.fileKey) await deleteObject(existing.fileKey).catch(() => {});
      fileFilename = data.file.filename;
    }

    return prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: {
        schoolId,
        assignmentId,
        studentId,
        textAnswer: data.textAnswer,
        fileKey,
        fileFilename,
      },
      update: {
        textAnswer: data.textAnswer,
        submittedAt: new Date(),
        ...(fileKey ? { fileKey, fileFilename } : {}),
      },
    });
  },

  async getSubmissionFileDownloadUrl(schoolId: string, assignmentId: string, studentId: string) {
    const submission = await prisma.submission.findFirst({ where: { schoolId, assignmentId, studentId } });
    if (!submission?.fileKey) throw new HttpError(404, "No file attached to this submission");
    return getDownloadUrl(submission.fileKey);
  },

  async gradeSubmission(
    schoolId: string,
    assignmentId: string,
    studentId: string,
    data: { marksObtained: number | null; feedback?: string },
    gradedByUserId: string,
  ) {
    const submission = await prisma.submission.findFirst({ where: { schoolId, assignmentId, studentId } });
    if (!submission) throw new HttpError(404, "This student hasn't submitted this assignment yet");

    const updated = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        marksObtained: data.marksObtained,
        feedback: data.feedback,
        gradedByUserId,
        gradedAt: new Date(),
      },
    });

    const [assignment, student] = await Promise.all([
      prisma.assignment.findFirst({ where: { id: assignmentId, schoolId } }),
      prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { userId: true } }),
    ]);
    if (assignment && student) {
      const parentUserIds = await studentGuardianService.getGuardianUserIdsForStudents(schoolId, [studentId]);
      const { percentage, grade } = scoreFor(data.marksObtained, assignment.maxMarks);
      await inAppNotificationService.notifyMany(schoolId, [student.userId, ...parentUserIds], {
        type: "grade",
        title: "Assignment graded",
        body:
          percentage !== null
            ? `${assignment.title}: ${percentage}% (${grade})`
            : `${assignment.title} has been graded`,
        link: `/dashboard/assignments/${assignmentId}`,
      });
    }

    return updated;
  },
};
