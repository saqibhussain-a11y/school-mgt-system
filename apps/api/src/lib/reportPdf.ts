import { newPdf, collectPdf, drawDocumentHeader, drawSignatureFooter, drawTable } from "./pdfShell";

// A tabular PDF summary of report data — deliberately not a rendered chart
// image (that would need a headless browser or a canvas lib, the same
// weight tradeoff already decided against for Documents). The on-screen
// report page shows an interactive chart; this export is the same
// underlying rows as a printable/archivable document.
export function generateReportPdf(
  schoolName: string,
  title: string,
  columns: { key: string; label: string; width: number }[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const doc = newPdf();
  drawDocumentHeader(doc, schoolName, title);
  drawTable(
    doc,
    columns.map((c) => ({ label: c.label, width: c.width })),
    rows.map((row) => columns.map((c) => String(row[c.key] ?? ""))),
    doc.y,
  );
  drawSignatureFooter(doc, new Date(), "Generated report");
  return collectPdf(doc);
}
