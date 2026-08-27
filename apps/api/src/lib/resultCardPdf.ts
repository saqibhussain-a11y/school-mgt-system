import { HttpError } from "../middleware/errorHandler";
import { newPdf, collectPdf } from "./pdfShell";
import { getObjectBuffer } from "./storage";
import { examService } from "../services/exam.service";
import { resultCardTemplateService, type Marker } from "../services/resultCardTemplate.service";

const DEFAULT_FONT_SIZE = 11;

// Slot-indexed, not tied to a real Subject — the same template is
// calibrated once and reused across every class, and different classes
// have different subject lists (Subject is class-scoped), so a marker can
// only ever mean "the Nth subject row on the card," never a specific
// subjectId. A class with fewer subjects than slots just leaves the extra
// slots blank; a class with more subjects than slots leaves the overflow
// unprinted — a real, disclosed limit of a school reusing one generic card
// across differently-sized classes, not a bug.
function resolveMarkerValue(
  marker: Marker,
  student: Awaited<ReturnType<typeof examService.getClassResultSheet>>["students"][number],
  subjects: Awaited<ReturnType<typeof examService.getClassResultSheet>>["subjects"],
  exam: Awaited<ReturnType<typeof examService.getClassResultSheet>>["exam"],
): string {
  const subjectSlotMatch = marker.fieldKey.match(/^subject(Obtained|Total):(\d+)$/);
  if (subjectSlotMatch) {
    const slotIndex = Number(subjectSlotMatch[2]) - 1;
    const subject = subjects[slotIndex];
    if (!subject) return "";
    if (subjectSlotMatch[1] === "Total") return String(subject.maxMarks);
    const mark = student.subjectMarks[slotIndex];
    if (!mark) return "";
    if (mark.isAbsent) return "Absent";
    return mark.marksObtained !== null ? String(mark.marksObtained) : "";
  }

  switch (marker.fieldKey) {
    case "studentName":
      return `${student.firstName} ${student.lastName}`;
    case "admissionNo":
      return student.admissionNo;
    case "className":
      return exam.className;
    case "examName":
      return exam.name;
    case "overallPercentage":
      return student.overallPercentage !== null ? `${student.overallPercentage}%` : "";
    case "overallGrade":
      return student.overallGrade ?? "";
    case "rank":
      return student.rank !== null ? String(student.rank) : "";
    default:
      return "";
  }
}

export async function buildResultCardsPdf(
  schoolId: string,
  examId: string,
  mode: "OVERLAY" | "FULL",
) {
  const template = await resultCardTemplateService.get(schoolId);
  if (!template) {
    throw new HttpError(400, "Set up a result card template before generating result cards");
  }
  const markers = template.markers as unknown as Marker[];

  const sheet = await examService.getClassResultSheet(schoolId, examId);
  if (sheet.students.length === 0) {
    throw new HttpError(404, "No active students in this class");
  }

  const templateImageBuffer = mode === "FULL" ? await getObjectBuffer(template.imageKey) : null;

  const doc = newPdf();
  sheet.students.forEach((student, index) => {
    if (index > 0) doc.addPage();
    if (templateImageBuffer) {
      doc.image(templateImageBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });
    }
    for (const marker of markers) {
      const value = resolveMarkerValue(marker, student, sheet.subjects, sheet.exam);
      if (!value) continue;
      const x = marker.xRatio * doc.page.width;
      const y = marker.yRatio * doc.page.height;
      doc
        .font("Helvetica")
        .fontSize(marker.fontSize ?? DEFAULT_FONT_SIZE)
        .fillColor("#111111")
        .text(value, x, y, { lineBreak: false });
    }
  });

  return collectPdf(doc);
}
