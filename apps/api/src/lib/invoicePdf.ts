import { newPdf, collectPdf, drawDocumentHeader, drawSignatureFooter, drawTable, formatLongDate } from "./pdfShell";

interface InvoicePdfData {
  invoiceNo: string;
  student: { fullName: string; admissionNo: string; className: string; sectionName: string };
  category: string;
  period: string;
  dueDate: Date;
  amount: number;
  discountAmount: number;
  netAmount: number;
  effectivePaid: number;
  balance: number;
  status: string;
  payments: { date: Date; amount: number; referenceNote: string | null }[];
}

const STATUS_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
};

// Generated fresh on every request (never stored) — an invoice's
// balance/status changes as payments come in, so a persisted PDF would go
// stale the moment a payment is recorded. Unlike certificates (which are a
// point-in-time issuance record), this always reflects the current ledger.
export function generateInvoicePdf(schoolName: string, data: InvoicePdfData): Promise<Buffer> {
  const doc = newPdf();
  drawDocumentHeader(doc, schoolName, "Fee Invoice", `Invoice No: ${data.invoiceNo}`);

  doc.text(`Student: ${data.student.fullName} (${data.student.admissionNo})`);
  doc.text(`Class: ${data.student.className} - Section ${data.student.sectionName}`);
  doc.text(`Fee category: ${data.category}`);
  doc.text(`Period: ${data.period}`);
  doc.text(`Due date: ${formatLongDate(data.dueDate)}`);
  doc.text(`Status: ${STATUS_LABELS[data.status] ?? data.status}`);
  doc.moveDown();

  let y = doc.y;
  y = drawTable(
    doc,
    [{ label: "", width: 260 }, { label: "", width: 200 }],
    [
      ["Amount", String(data.amount)],
      ["Discount", String(data.discountAmount)],
      ["Net amount", String(data.netAmount)],
      ["Amount paid", String(data.effectivePaid)],
      ["Balance due", String(data.balance)],
    ],
    y,
  );

  if (data.payments.length > 0) {
    doc.moveDown();
    doc.font("Helvetica-Bold").fontSize(11).text("Payment history", 60, y + 16);
    y = drawTable(
      doc,
      [
        { label: "Date", width: 130 },
        { label: "Amount", width: 130 },
        { label: "Reference", width: 200 },
      ],
      data.payments.map((p) => [formatLongDate(p.date), String(p.amount), p.referenceNote ?? "—"]),
      y + 36,
    );
  }

  drawSignatureFooter(doc, new Date(), "Accounts Office");
  return collectPdf(doc);
}
