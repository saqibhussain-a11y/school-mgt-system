import { prisma, Prisma } from "@sms/db";
import { HttpError } from "../middleware/errorHandler";
import { putObject, getDownloadUrl, deleteObject } from "../lib/storage";
import { generateCertificatePdf, DOCUMENT_TITLES, type DocumentType } from "../lib/certificates";

const issuedDocumentInclude = {
  student: {
    select: {
      id: true,
      admissionNo: true,
      user: { select: { firstName: true, lastName: true } },
      class: { select: { name: true } },
    },
  },
  issuedBy: { select: { id: true, firstName: true, lastName: true } },
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

const MAX_CERTIFICATE_NO_ATTEMPTS = 3;

// Was `${type}-${year}-${studentId}` with no running count — every
// issuance of the same type to the same student in the same year printed
// the IDENTICAL number, defeating the whole point of a certificate number
// (verifying which specific document is genuine) the moment a school
// re-issued one (lost original, needs a duplicate — a legitimate action,
// same as fee payments deliberately allowing a real duplicate). Counting
// existing rows isn't itself race-proof against two truly simultaneous
// requests, so `@@unique([schoolId, certificateNo])` is the real backstop —
// generate() retries with a freshly-counted number on a collision instead
// of erroring.
async function nextCertificateNo(schoolId: string, studentId: string, type: DocumentType, year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const count = await prisma.issuedDocument.count({
    where: { schoolId, studentId, type, issuedAt: { gte: yearStart, lt: yearEnd } },
  });
  return `${type.slice(0, 3).toUpperCase()}-${year}-${studentId.slice(-6).toUpperCase()}-${count + 1}`;
}

async function loadStudentForCertificate(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      class: { select: { name: true, academicSession: { select: { name: true } } } },
      section: { select: { name: true } },
      guardians: {
        include: { guardian: { include: { user: { select: { firstName: true, lastName: true } } } } },
      },
    },
  });
  if (!student) throw new HttpError(404, "Student not found");

  const primaryGuardian = student.guardians.find((g) => g.isPrimaryContact) ?? student.guardians[0];

  return {
    fullName: `${student.user.firstName} ${student.user.lastName}`,
    admissionNo: student.admissionNo,
    dob: student.dob,
    admissionDate: student.admissionDate,
    className: student.class.name,
    sectionName: student.section.name,
    sessionName: student.class.academicSession.name,
    guardianName: primaryGuardian
      ? `${primaryGuardian.guardian.user.firstName} ${primaryGuardian.guardian.user.lastName}`
      : null,
  };
}

export const documentIssuanceService = {
  async generate(
    schoolId: string,
    input: {
      studentId: string;
      type: DocumentType;
      fields?: { purpose?: string; reason?: string; conduct?: string; leavingDate?: Date };
      issuedByUserId: string;
    },
  ) {
    const [school, studentInfo] = await Promise.all([
      prisma.school.findUniqueOrThrow({ where: { id: schoolId } }),
      loadStudentForCertificate(schoolId, input.studentId),
    ]);

    const issueDate = new Date();

    for (let attempt = 1; attempt <= MAX_CERTIFICATE_NO_ATTEMPTS; attempt++) {
      const certificateNo = await nextCertificateNo(schoolId, input.studentId, input.type, issueDate.getFullYear());

      const pdfBuffer = await generateCertificatePdf(
        input.type,
        school.name,
        studentInfo,
        input.fields ?? {},
        certificateNo,
        issueDate,
      );

      const filename = sanitizeFilename(`${DOCUMENT_TITLES[input.type]}-${studentInfo.fullName}.pdf`);
      const key = `schools/${schoolId}/documents/${input.studentId}/${Date.now()}-${filename}`;
      await putObject(key, pdfBuffer, "application/pdf");

      try {
        return await prisma.issuedDocument.create({
          data: {
            schoolId,
            studentId: input.studentId,
            type: input.type,
            fileKey: key,
            fileFilename: filename,
            fields: input.fields ?? {},
            issuedByUserId: input.issuedByUserId,
            issuedAt: issueDate,
            certificateNo,
          },
          include: issuedDocumentInclude,
        });
      } catch (err) {
        const isCollision = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isCollision || attempt === MAX_CERTIFICATE_NO_ATTEMPTS) {
          await deleteObject(key).catch(() => {});
          throw err;
        }
        // Lost a genuine simultaneous-issuance race — the PDF we just
        // uploaded has the now-stale number printed on it; discard it and
        // regenerate with a freshly-counted one on the next loop iteration.
        await deleteObject(key).catch(() => {});
      }
    }
    throw new HttpError(409, "Could not allocate a certificate number — please try again.");
  },

  list(schoolId: string, filters: { studentId?: string; type?: string } = {}) {
    return prisma.issuedDocument.findMany({
      where: { schoolId, ...filters },
      include: issuedDocumentInclude,
      orderBy: { issuedAt: "desc" },
    });
  },

  getById(schoolId: string, id: string) {
    return prisma.issuedDocument.findFirst({ where: { id, schoolId }, include: issuedDocumentInclude });
  },

  async getDownloadUrl(schoolId: string, id: string) {
    const doc = await prisma.issuedDocument.findFirst({ where: { id, schoolId } });
    if (!doc) throw new HttpError(404, "Document not found");
    return getDownloadUrl(doc.fileKey);
  },

  async remove(schoolId: string, id: string) {
    const doc = await prisma.issuedDocument.findFirst({ where: { id, schoolId } });
    if (!doc) return null;
    await deleteObject(doc.fileKey).catch(() => {});
    await prisma.issuedDocument.delete({ where: { id } });
    return doc;
  },
};
