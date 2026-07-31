import { prisma } from "@sms/db";
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
    const certificateNo = `${input.type.slice(0, 3).toUpperCase()}-${issueDate.getFullYear()}-${input.studentId.slice(-6).toUpperCase()}`;

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

    return prisma.issuedDocument.create({
      data: {
        schoolId,
        studentId: input.studentId,
        type: input.type,
        fileKey: key,
        fileFilename: filename,
        fields: input.fields ?? {},
        issuedByUserId: input.issuedByUserId,
        issuedAt: issueDate,
      },
      include: issuedDocumentInclude,
    });
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
