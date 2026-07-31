// Minimal CSV writer — no dependency needed for this. Excel opens CSV
// natively, which is what the master doc's "PDF/Excel export" actually
// needs in practice; a real .xlsx would pull in a whole new library for no
// end-user-visible benefit here.
export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  function escape(value: unknown) {
    const str = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}
