// Minimal CSV writer — no dependency needed for this. Excel opens CSV
// natively, which is what the master doc's "PDF/Excel export" actually
// needs in practice; a real .xlsx would pull in a whole new library for no
// end-user-visible benefit here.
export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  function escape(value: unknown) {
    let str = value === null || value === undefined ? "" : String(value);
    // Formula-injection guard: Excel/Sheets treat a cell starting with any
    // of these as the start of a formula regardless of quoting — a
    // free-text field (student/guardian name, reference note) could
    // otherwise plant a formula that executes when someone opens the
    // export. A leading literal single-quote is the standard mitigation;
    // spreadsheet apps render it as plain text, not part of the value.
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}
