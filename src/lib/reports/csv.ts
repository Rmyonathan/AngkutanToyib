/**
 * Excel-friendly CSV download (UTF-8 BOM + semicolon separator so Excel
 * with Indonesian locale opens it directly into columns).
 */
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v) : v;
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(";");
  const body = rows.map((r) =>
    columns.map((c) => escapeCell(c.value(r))).join(";")
  );
  return [head, ...body].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
