// Minimal RFC 4180 CSV. Money should be passed already formatted (centsToInput) so it stays exact.

export type Cell = string | number | null | undefined;

function escape(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  let s = String(cell);
  // Stop spreadsheet apps from treating text like "=SUM(…)" as a formula.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, rows: Cell[][]): Response {
  // BOM so Excel opens UTF-8 (e.g. "–") correctly.
  return new Response("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\- ]+/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
