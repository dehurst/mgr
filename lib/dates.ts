// Calendar dates are "YYYY-MM-DD" strings. They compare correctly as strings, so range
// checks are `from <= d && d <= to`. Arithmetic goes through UTC so the local time zone
// and DST can never shift a date.

export type DateStr = string;
export type DateRange = { from: DateStr; to: DateStr };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(s: string | null | undefined): s is DateStr {
  if (!s) return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

/** Today's date in the machine's local time zone. Pass `now` in tests. */
export function today(now: Date = new Date()): DateStr {
  return fmt(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(date: DateStr, days: number): DateStr {
  const [y, m, d] = parts(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole days from `a` to `b` (positive if b is later). */
export function daysBetween(a: DateStr, b: DateStr): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function inRange(date: DateStr, range: DateRange): boolean {
  return range.from <= date && date <= range.to;
}

export function yearOf(date: DateStr): number {
  return parts(date)[0];
}

export function startOfMonth(date: DateStr): DateStr {
  const [y, m] = parts(date);
  return fmt(y, m, 1);
}

export function endOfMonth(date: DateStr): DateStr {
  const [y, m] = parts(date);
  return fmt(y, m, daysInMonth(y, m));
}

/** Shift by whole months, clamping the day (Mar 31 - 1 month = Feb 28/29). */
export function addMonths(date: DateStr, months: number): DateStr {
  const [y, m, d] = parts(date);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export const RANGE_PRESETS = [
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "ytd",
  "this_year",
  "last_year",
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  last_quarter: "Last quarter",
  ytd: "Year to date",
  this_year: "This year",
  last_year: "Last year",
};

/** Inclusive date range for a preset, relative to `ref` (normally today()). */
export function presetRange(preset: RangePreset, ref: DateStr): DateRange {
  const [y, m] = parts(ref);
  const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
  switch (preset) {
    case "this_month":
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    case "last_month": {
      const prev = addMonths(fmt(y, m, 1), -1);
      return { from: prev, to: endOfMonth(prev) };
    }
    case "this_quarter": {
      const from = fmt(y, qStartMonth, 1);
      return { from, to: endOfMonth(addMonths(from, 2)) };
    }
    case "last_quarter": {
      const from = addMonths(fmt(y, qStartMonth, 1), -3);
      return { from, to: endOfMonth(addMonths(from, 2)) };
    }
    case "ytd":
      return { from: fmt(y, 1, 1), to: ref };
    case "this_year":
      return { from: fmt(y, 1, 1), to: fmt(y, 12, 31) };
    case "last_year":
      return { from: fmt(y - 1, 1, 1), to: fmt(y - 1, 12, 31) };
  }
}

/** Format "2026-01-05" as "Jan 5, 2026" without going through local time. */
export function formatDate(date: DateStr | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = parts(date.slice(0, 10));
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: DateStr): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new TypeError(`Invalid date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function fmt(y: number, m: number, d: number): DateStr {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
