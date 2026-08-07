import { prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { newPdf, collectPdf, drawDocumentHeader, drawSignatureFooter, drawTable, formatLongDate } from "./pdfShell";

interface AdmitCardScope {
  examSessionId: string | null;
  exams: { classId: string; examSubjects: { subjectId: string; subject: { name: string }; maxMarks: number; examDate: Date | null; startTime: string | null; endTime: string | null }[] }[];
}

async function resolveScope(
  schoolId: string,
  params: { examSessionId?: string; examId?: string },
): Promise<AdmitCardScope> {
  const examSubjectsInclude = { examSubjects: { include: { subject: true } } };

  if (params.examSessionId) {
    const exams = await prisma.exam.findMany({
      where: { schoolId, examSessionId: params.examSessionId },
      include: examSubjectsInclude,
    });
    return { examSessionId: params.examSessionId, exams };
  }
  if (params.examId) {
    const exam = await prisma.exam.findFirst({
      where: { id: params.examId, schoolId },
      include: examSubjectsInclude,
    });
    if (!exam) throw new HttpError(404, "Exam not found");
    if (exam.examSessionId) {
      const exams = await prisma.exam.findMany({
        where: { schoolId, examSessionId: exam.examSessionId },
        include: examSubjectsInclude,
      });
      return { examSessionId: exam.examSessionId, exams };
    }
    // Read-only render — unlike seat generation, this does NOT lazily
    // create a session for a standalone exam; it just renders without a
    // seat map ("Not yet assigned").
    return { examSessionId: null, exams: [exam] };
  }
  throw new HttpError(400, "examId or examSessionId is required");
}

// Batch-fetches everything up front (students, seat allocations, subjects)
// in a constant number of queries — no N+1 per student, same discipline as
// timetableGenerator.service.ts's seed-busy maps.
export async function buildAdmitCardsPdf(
  schoolId: string,
  params: { examSessionId?: string; examId?: string; classIds?: string[]; studentId?: string },
): Promise<Buffer> {
  const scope = await resolveScope(schoolId, params);
  const scopeClassIds = scope.exams.map((e) => e.classId);
  if (scopeClassIds.length === 0) throw new HttpError(404, "This exam has no classes to generate admit cards for");

  // classIds narrows within the resolved scope — the caller (route layer)
  // is responsible for ensuring any narrowing reflects real permissions,
  // never trusting a client-supplied scope for a document that can embed
  // other classes' seat/room data.
  const effectiveClassIds = params.classIds
    ? params.classIds.filter((id) => scopeClassIds.includes(id))
    : scopeClassIds;

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      classId: { in: effectiveClassIds },
      status: "ACTIVE",
      ...(params.studentId ? { id: params.studentId } : {}),
    },
    include: { user: { select: { firstName: true, lastName: true } }, class: true, section: true },
    orderBy: [{ classId: "asc" }, { admissionNo: "asc" }],
  });
  if (students.length === 0) throw new HttpError(404, "No students found for this admit-card request");

  const examSubjectsByClass = new Map(scope.exams.map((e) => [e.classId, e.examSubjects]));

  const seatByStudentId = new Map<string, { room: { name: string }; seatNumber: number }>();
  if (scope.examSessionId) {
    const seats = await prisma.examSeatAllocation.findMany({
      where: { schoolId, examSessionId: scope.examSessionId, studentId: { in: students.map((s) => s.id) } },
      include: { room: true },
    });
    for (const seat of seats) seatByStudentId.set(seat.studentId, seat);
  }

  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });

  const doc = newPdf();
  students.forEach((student, index) => {
    if (index > 0) doc.addPage();
    drawDocumentHeader(doc, school.name, "Admit Card");

    doc.font("Helvetica-Bold").fontSize(12).text(`${student.user.firstName} ${student.user.lastName}`);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`Admission No: ${student.admissionNo}    Class: ${student.class.name} - ${student.section.name}`);
    doc.moveDown();

    const subjects = (examSubjectsByClass.get(student.classId) ?? []).slice().sort((a, b) => {
      if (!a.examDate || !b.examDate) return 0;
      return a.examDate.getTime() - b.examDate.getTime();
    });
    const rows = subjects.map((s) => [
      s.subject.name,
      s.examDate ? formatLongDate(s.examDate) : "Not yet scheduled",
      s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : "-",
      String(s.maxMarks),
    ]);
    const afterTableY = drawTable(
      doc,
      [
        { label: "Subject", width: 200 },
        { label: "Date", width: 140 },
        { label: "Time", width: 90 },
        { label: "Max Marks", width: 65 },
      ],
      rows,
      doc.y,
    );

    doc.y = afterTableY + 10;
    const seat = seatByStudentId.get(student.id);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(seat ? `Room: ${seat.room.name}    Seat No: ${seat.seatNumber}` : "Room/Seat: Not yet assigned");

    drawSignatureFooter(doc, new Date(), "Principal / Invigilator");
  });

  return collectPdf(doc);
}
