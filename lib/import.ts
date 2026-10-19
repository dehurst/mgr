// Reading bank and card statement CSVs, and suggesting how each line should be entered. Pure and
// browser-safe: the import page parses the file in the browser; the server adds history (past
// vendors' categories) and existing expenses (for duplicate checks) via suggestImport().
import { daysBetween, isValidDate, type DateStr } from "./dates";
import { parseCents } from "./money";

export const MAX_IMPORT_ROWS = 2000;

/** RFC 4180 CSV: quoted fields, doubled quotes, commas/newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Statement dates: 2024-03-05, 03/05/2024, 3/5/24, 03-05-2024. Two-digit years are 20xx. */
export function parseStatementDate(raw: string): DateStr | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else return null;
  const out = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidDate(out) ? out : null;
}

/** Statement amounts: "$1,234.56", "-12.00", "(12.00)" (negative), "12.00 CR" (negative). */
export function parseStatementAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/CR$/i.test(s)) {
    negative = !negative;
    s = s.slice(0, -2);
  }
  for (const prefix of ["-", "$", "-"]) {
    if (!s.startsWith(prefix)) continue;
    if (prefix === "-") negative = !negative;
    s = s.slice(1);
  }
  const cents = parseCents(s);
  if (cents === null) return null;
  return negative ? -cents : cents;
}

export type Columns = { date: number; description: number; amount?: number; debit?: number; credit?: number };

/** Find the date, description, and amount (or debit/credit) columns from the header row. */
export function detectColumns(header: string[]): Columns | null {
  const h = header.map((x) => x.trim().toLowerCase());
  const find = (...tests: RegExp[]) => {
    for (const t of tests) {
      const i = h.findIndex((x) => t.test(x));
      if (i >= 0) return i;
    }
    return -1;
  };
  // Prefer the transaction date over the posting date.
  const date = find(/^(transaction|trans\.?|txn) ?date$/, /^date$/, /date/);
  const description = find(/^description$/, /description/, /^(payee|merchant|name)$/, /payee|merchant|details|memo|name/);
  const amount = find(/^amount$/, /amount/);
  const debit = find(/^debit/, /withdrawal|debit/);
  const credit = find(/^credit/, /deposit|credit/);
  if (date < 0 || description < 0) return null;
  if (amount >= 0) return { date, description, amount };
  if (debit >= 0) return { date, description, debit, credit: credit >= 0 ? credit : undefined };
  return null;
}

/** How a statement shows money spent in a single Amount column. */
export type ChargeSign = "positive" | "negative";

export type StatementLine = {
  line: number;
  date: DateStr;
  description: string;
  /** Money spent is positive; money in (refunds, payments, deposits) is negative. */
  amountCents: number;
};

export type StatementParse = {
  lines: StatementLine[];
  errors: { line: number; message: string }[];
  columns: Columns | null;
  /** The sign convention used (detected unless one was given). Null with debit/credit columns. */
  chargeSign: ChargeSign | null;
};

export function parseStatement(text: string, chargeSign?: ChargeSign): StatementParse {
  const rows = parseCsv(text);
  // Some banks put a few lines of account info above the header; take the first row that parses.
  const headerAt = rows.findIndex((r) => detectColumns(r));
  if (headerAt < 0) {
    return { lines: [], errors: [{ line: 1, message: "Couldn't find Date, Description, and Amount columns." }], columns: null, chargeSign: null };
  }
  const columns = detectColumns(rows[headerAt])!;
  const errors: StatementParse["errors"] = [];
  const raw: { line: number; date: DateStr; description: string; cents: number }[] = [];
  rows.slice(headerAt + 1).forEach((r, i) => {
    const line = headerAt + i + 2;
    const date = parseStatementDate(r[columns.date] ?? "");
    const description = (r[columns.description] ?? "").replace(/\s+/g, " ").trim();
    let cents: number | null;
    if (columns.amount !== undefined) cents = parseStatementAmount(r[columns.amount] ?? "");
    else {
      const debit = parseStatementAmount(r[columns.debit!] ?? "") ?? 0;
      const credit = columns.credit !== undefined ? (parseStatementAmount(r[columns.credit] ?? "") ?? 0) : 0;
      cents = Math.abs(debit) - Math.abs(credit);
    }
    if (!date) return errors.push({ line, message: `Unreadable date "${r[columns.date] ?? ""}".` });
    if (cents === null) return errors.push({ line, message: `Unreadable amount on ${date}.` });
    if (cents === 0) return;
    raw.push({ line, date, description, cents });
  });

  let sign: ChargeSign | null = null;
  if (columns.amount !== undefined) {
    // Most lines on a statement are purchases, so the more common sign is the charge sign.
    sign = chargeSign ?? (raw.filter((r) => r.cents < 0).length > raw.length / 2 ? "negative" : "positive");
  }
  const lines = raw.map((r) => ({ line: r.line, date: r.date, description: r.description, amountCents: sign === "negative" ? -r.cents : r.cents }));
  return { lines, errors, columns, chargeSign: sign };
}

/** "SQ *BLUE BOTTLE COFFEE 0123" -> "Blue Bottle Coffee". Keeps it recognizable; edit freely. */
export function cleanVendor(description: string): string {
  let s = description
    .replace(/^(sq|tst|sp|py|pp|paypal|square|pos|dd|ach|debit card purchase|purchase|recurring payment|checkcard \d+)\s*\*?\s*/i, "")
    .replace(/\s*\*.*$/, "") // "MERCHANT *DETAILS" -> "MERCHANT"
    .replace(/\s*#\s*[\w-]*\d[\w-]*/g, " ") // store numbers like #1234
    .replace(/\s+\d{3,}\b.*$/, "") // trailing long numbers and whatever follows (often city/state)
    .replace(/\s+/g, " ")
    .trim();
  if (!s) s = description.trim();
  // Title-case ALL-CAPS text; leave mixed case alone.
  if (s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s\-&/(.])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
  return s.slice(0, 80);
}

const MOVE_PATTERNS: [RegExp, string][] = [
  [/payment\s*(-\s*)?thank\s*you|autopay|auto[\s-]?pay|online payment|mobile payment|payment received|epayment|card payment|credit card payment|amex epayment/i, "Card payment"],
  [/\btransfer\b|\bxfer\b|online banking transfer/i, "Transfer between accounts"],
  [/interest charge|finance charge|late fee/i, "Card interest/fees (not usually deductible for personal cards)"],
];

export type HistoryVendor = { vendor: string; categoryId: number; businessPct: number };
export type ExistingExpense = { paidOn: DateStr; amountCents: number; vendor: string };

export type Suggestion = StatementLine & {
  vendor: string;
  categoryId: number | null;
  businessPct: number;
  include: boolean;
  note: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** One name contains the other, ignoring names too short to mean anything. */
const similar = (a: string, b: string) => a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));

/**
 * For each statement line: a cleaned vendor, a category from the closest past vendor, and whether
 * to include it. Card payments, transfers, money in, and likely duplicates start unchecked.
 */
export function suggestImport(lines: StatementLine[], history: HistoryVendor[], existing: ExistingExpense[]): Suggestion[] {
  const known = history.map((h) => ({ ...h, key: norm(h.vendor) })).filter((h) => h.key.length >= 3).sort((a, b) => b.key.length - a.key.length);
  return lines.map((l) => {
    const vendor = cleanVendor(l.description);
    const desc = norm(l.description);
    const match = known.find((h) => desc.includes(h.key) || norm(vendor) === h.key);
    const out: Suggestion = {
      ...l,
      vendor: match ? match.vendor : vendor,
      categoryId: match?.categoryId ?? null,
      businessPct: match?.businessPct ?? 100,
      include: true,
      note: match ? `Like your past "${match.vendor}" expenses` : "",
    };
    const move = MOVE_PATTERNS.find(([re]) => re.test(l.description));
    if (move) return { ...out, include: false, note: `${move[1]}: skipped so spending isn't counted twice` };
    const dup = existing.find(
      (e) =>
        e.amountCents === l.amountCents &&
        Math.abs(daysBetween(e.paidOn, l.date)) <= 3 &&
        (e.paidOn === l.date || similar(desc, norm(e.vendor)) || similar(norm(e.vendor), norm(vendor))),
    );
    if (dup) return { ...out, include: false, note: `Possible duplicate of ${dup.vendor} on ${dup.paidOn}` };
    if (l.amountCents < 0) return { ...out, include: false, note: "Money in: include only if it's a refund" };
    return out;
  });
}
