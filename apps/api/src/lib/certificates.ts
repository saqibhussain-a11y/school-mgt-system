import { newPdf, collectPdf, drawDocumentHeader, drawSignatureFooter, formatLongDate } from "./pdfShell";

export const DOCUMENT_TYPES = ["bonafide", "transfer_certificate", "character_certificate"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  bonafide: "Bonafide Certificate",
  transfer_certificate: "Transfer Certificate",
  character_certificate: "Character Certificate",
};

interface StudentInfo {
  fullName: string;
  admissionNo: string;
  dob: Date;
  admissionDate: Date;
  className: string;
  sectionName: string;
  sessionName: string;
  guardianName: string | null;
}

interface CertificateFields {
  purpose?: string;
  reason?: string;
  conduct?: string;
  leavingDate?: Date;
}

function bonafideBody(doc: PDFKit.PDFDocument, s: StudentInfo, fields: CertificateFields) {
  const guardianClause = s.guardianName ? `, son/daughter of ${s.guardianName},` : ",";
  doc.text(
    `This is to certify that ${s.fullName}${guardianClause} bearing Admission No. ${s.admissionNo} and Date of Birth ${formatLongDate(s.dob)}, is a bona fide student of this school, currently studying in Class ${s.className} - Section ${s.sectionName} during the ${s.sessionName} academic session.`,
    { align: "justify" },
  );
  doc.moveDown();
  doc.text(
    `This certificate is issued${fields.purpose ? ` for the purpose of ${fields.purpose}` : " upon request"}.`,
    { align: "justify" },
  );
}

function transferCertificateBody(doc: PDFKit.PDFDocument, s: StudentInfo, fields: CertificateFields) {
  const leavingDate = fields.leavingDate ?? new Date();
  doc.text(
    `This is to certify that ${s.fullName}, bearing Admission No. ${s.admissionNo} and Date of Birth ${formatLongDate(s.dob)}, was a student of this school from ${formatLongDate(s.admissionDate)} to ${formatLongDate(leavingDate)}, and last studied in Class ${s.className} - Section ${s.sectionName} during the ${s.sessionName} academic session.`,
    { align: "justify" },
  );
  doc.moveDown();
  doc.text(`Reason for leaving: ${fields.reason || "Not specified"}.`, { align: "justify" });
  doc.moveDown();
  doc.text(`Conduct during the period of study: ${fields.conduct || "Satisfactory"}.`, { align: "justify" });
  doc.moveDown();
  doc.text("This Transfer Certificate is issued upon request.", { align: "justify" });
}

function characterCertificateBody(doc: PDFKit.PDFDocument, s: StudentInfo, fields: CertificateFields) {
  doc.text(
    `This is to certify that ${s.fullName}, bearing Admission No. ${s.admissionNo}, studied at this school from ${formatLongDate(s.admissionDate)} to ${formatLongDate(new Date())}, most recently in Class ${s.className} - Section ${s.sectionName} during the ${s.sessionName} academic session.`,
    { align: "justify" },
  );
  doc.moveDown();
  doc.text(
    `During this period, the student's conduct and character were observed to be ${fields.conduct || "good"}.`,
    { align: "justify" },
  );
  doc.moveDown();
  doc.text(
    `This certificate is issued${fields.purpose ? ` for the purpose of ${fields.purpose}` : " upon request"}.`,
    { align: "justify" },
  );
}

const BODY_BUILDERS: Record<DocumentType, typeof bonafideBody> = {
  bonafide: bonafideBody,
  transfer_certificate: transferCertificateBody,
  character_certificate: characterCertificateBody,
};

export function generateCertificatePdf(
  type: DocumentType,
  schoolName: string,
  student: StudentInfo,
  fields: CertificateFields,
  certificateNo: string,
  issueDate: Date,
): Promise<Buffer> {
  const doc = newPdf();
  drawDocumentHeader(doc, schoolName, DOCUMENT_TITLES[type], `Certificate No: ${certificateNo}`);
  BODY_BUILDERS[type](doc, student, fields);
  drawSignatureFooter(doc, issueDate);
  return collectPdf(doc);
}
