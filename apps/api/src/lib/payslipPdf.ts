import { newPdf, collectPdf, drawDocumentHeader, drawSignatureFooter, drawTable, formatLongDate } from "./pdfShell";

interface PayslipPdfData {
  staff: { fullName: string; designation: string };
  period: string;
  baseSalary: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  adjustments: { label: string; amount: number }[];
  netPay: number;
  status: string;
  paidAt: Date | null;
}

const STATUS_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
};

// Generated fresh on every request (never stored) — same convention as
// invoicePdf.ts, since an adjustment added after generation must show up
// on the next download without regenerating anything.
export function generatePayslipPdf(schoolName: string, data: PayslipPdfData): Promise<Buffer> {
  const doc = newPdf();
  drawDocumentHeader(doc, schoolName, "Payslip", `Period: ${data.period}`);

  doc.text(`Staff: ${data.staff.fullName}`);
  doc.text(`Designation: ${data.staff.designation}`);
  doc.text(`Status: ${STATUS_LABELS[data.status] ?? data.status}`);
  if (data.paidAt) doc.text(`Paid on: ${formatLongDate(data.paidAt)}`);
  doc.moveDown();

  const rows: string[][] = [["Base salary", String(data.baseSalary)]];
  if (data.unpaidLeaveDays > 0) {
    rows.push([`Unpaid leave (${data.unpaidLeaveDays} day(s))`, `-${data.unpaidLeaveDeduction}`]);
  }
  for (const adj of data.adjustments) {
    rows.push([adj.label, adj.amount >= 0 ? `+${adj.amount}` : String(adj.amount)]);
  }
  rows.push(["Net pay", String(data.netPay)]);

  let y = doc.y;
  y = drawTable(doc, [{ label: "", width: 300 }, { label: "", width: 160 }], rows, y);

  drawSignatureFooter(doc, new Date(), "Accounts Office");
  return collectPdf(doc);
}
