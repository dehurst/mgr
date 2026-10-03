// All money is integer cents. Nothing in this file uses floating-point arithmetic on amounts.

const MONEY_RE = /^(-)?\$?(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{0,2}))?$/;
const QTY_RE = /^(\d+)?(?:\.(\d{0,3}))?$/;

/**
 * Parse user input like "1,234.56", "$12", "-5.5" into integer cents.
 * Returns null for empty or invalid input, or for more than 2 decimal places.
 */
export function parseCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = input.trim().replace(/\s/g, "");
  if (s === "") return null;
  const m = MONEY_RE.exec(s);
  if (!m) return null;
  const [, neg, whole = "", frac = ""] = m;
  if (whole === "" && frac === "") return null;
  const cents =
    Number(whole.replace(/,/g, "") || "0") * 100 + Number(frac.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return neg && cents !== 0 ? -cents : cents;
}

/** Format integer cents as "$1,234.56" / "-$1,234.56". */
export function formatCents(cents: number, opts: { symbol?: boolean } = {}): string {
  assertCents(cents);
  const symbol = opts.symbol ?? true;
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = ((abs - (abs % 100)) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${symbol ? "$" : ""}${whole}.${frac}`;
}

/** Plain decimal string for form inputs and CSV: 123456 -> "1234.56". */
export function centsToInput(cents: number): string {
  return formatCents(cents, { symbol: false }).replace(/,/g, "");
}

/** Parse a quantity like "1.5" into integer thousandths (1500). Up to 3 decimals, non-negative. */
export function parseQuantityMilli(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = input.trim();
  if (s === "") return null;
  const m = QTY_RE.exec(s);
  if (!m) return null;
  const [, whole = "", frac = ""] = m;
  if (whole === "" && frac === "") return null;
  const milli = Number(whole || "0") * 1000 + Number(frac.padEnd(3, "0") || "0");
  return Number.isSafeInteger(milli) ? milli : null;
}

/** 1500 -> "1.5", 2000 -> "2", 1250 -> "1.25". */
export function formatQuantity(milli: number): string {
  assertCents(milli);
  const whole = (milli - (milli % 1000)) / 1000;
  const frac = (milli % 1000).toString().padStart(3, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/**
 * Line amount = quantity × unit price, rounded half away from zero to the cent.
 * Uses BigInt so large products can't lose precision.
 */
export function lineAmountCents(quantityMilli: number, unitPriceCents: number): number {
  assertCents(quantityMilli);
  assertCents(unitPriceCents);
  const product = BigInt(quantityMilli) * BigInt(unitPriceCents);
  const neg = product < BigInt(0);
  const abs = neg ? -product : product;
  const rounded = (abs + BigInt(500)) / BigInt(1000);
  const result = Number(neg ? -rounded : rounded);
  if (!Number.isSafeInteger(result)) throw new RangeError("Line amount out of range");
  return result;
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  if (!Number.isSafeInteger(total)) throw new RangeError("Sum out of range");
  return total;
}

function assertCents(n: number): void {
  if (!Number.isSafeInteger(n)) throw new TypeError(`Expected an integer, got ${n}`);
}
