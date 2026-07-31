import PDFDocument from "pdfkit";

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

function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Shared PDFKit shell — a bordered page, centered school name + title, and a
// signature footer — so the three certificate bodies only need to differ in
// their merged paragraph text, not in layout code.
function drawShell(doc: PDFKit.PDFDocument, schoolName: string, title: string, certificateNo: string) {
  doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).lineWidth(1.5).stroke("#333333");

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#111111").text(schoolName, { align: "center" });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#555555")
    .text(`Certificate No: ${certificateNo}`, { align: "center" });
  doc.moveDown(1.2);
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111").text(title.toUpperCase(), { align: "center" });
  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(12).fillColor("#111111");
}

function drawSignatureFooter(doc: PDFKit.PDFDocument, issueDate: Date) {
  const y = doc.page.height - 140;
  doc.font("Helvetica").fontSize(11).text(`Date: ${formatLongDate(issueDate)}`, 60, y);
  doc.text("_____________________________", doc.page.width - 260, y, { width: 200, align: "center" });
  doc.text("Principal / Head of School", doc.page.width - 260, y + 18, { width: 200, align: "center" });
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
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawShell(doc, schoolName, DOCUMENT_TITLES[type], certificateNo);
    BODY_BUILDERS[type](doc, student, fields);
    drawSignatureFooter(doc, issueDate);

    doc.end();
  });
}
