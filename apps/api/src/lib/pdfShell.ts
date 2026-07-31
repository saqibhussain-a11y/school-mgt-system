import PDFDocument from "pdfkit";

export function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function newPdf() {
  return new PDFDocument({ size: "A4", margin: 60 });
}

export function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

// Shared PDFKit shell — a bordered page, centered school name + title, and a
// signature footer — used by both certificates (lib/certificates.ts) and
// invoices/reports (lib/invoicePdf.ts, lib/reportPdf.ts) so every generated
// document in this app shares the same look without duplicating layout code.
export function drawDocumentHeader(doc: PDFKit.PDFDocument, schoolName: string, title: string, refNo?: string) {
  doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).lineWidth(1.5).stroke("#333333");

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#111111").text(schoolName, { align: "center" });
  if (refNo) {
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor("#555555").text(refNo, { align: "center" });
  }
  doc.moveDown(1.2);
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111111").text(title.toUpperCase(), { align: "center" });
  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(12).fillColor("#111111");
}

export function drawSignatureFooter(doc: PDFKit.PDFDocument, issueDate: Date, signatoryLabel = "Principal / Head of School") {
  const y = doc.page.height - 140;
  doc.font("Helvetica").fontSize(11).text(`Date: ${formatLongDate(issueDate)}`, 60, y);
  doc.text("_____________________________", doc.page.width - 260, y, { width: 200, align: "center" });
  doc.text(signatoryLabel, doc.page.width - 260, y + 18, { width: 200, align: "center" });
}

// A simple bordered grid table — PDFKit has no table primitive, so this is
// deliberately minimal: fixed column widths, a bold header row, one line of
// text per cell (long values are the caller's problem to keep short).
export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: { label: string; width: number }[],
  rows: string[][],
  startY: number,
) {
  const left = 60;
  const rowHeight = 22;
  let y = startY;

  function drawRow(values: string[], bold: boolean) {
    let x = left;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
    for (let i = 0; i < columns.length; i++) {
      doc.text(values[i] ?? "", x + 4, y + 6, { width: columns[i].width - 8, ellipsis: true });
      x += columns[i].width;
    }
    doc.rect(left, y, columns.reduce((s, c) => s + c.width, 0), rowHeight).stroke("#cccccc");
    y += rowHeight;
  }

  drawRow(columns.map((c) => c.label), true);
  for (const row of rows) {
    if (y > doc.page.height - 160) {
      doc.addPage();
      y = 60;
      drawRow(columns.map((c) => c.label), true);
    }
    drawRow(row, false);
  }
  return y;
}
