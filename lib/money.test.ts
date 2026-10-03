import { describe, expect, it } from "vitest";
import {
  businessShareCents,
  centsToInput,
  formatCents,
  formatQuantity,
  lineAmountCents,
  parseCents,
  parseQuantityMilli,
  sumCents,
} from "./money";

describe("parseCents", () => {
  it.each([
    ["0", 0],
    ["5", 500],
    ["5.5", 550],
    ["5.05", 505],
    [".5", 50],
    ["1,234.56", 123456],
    ["$1,234,567.89", 123456789],
    ["  $12.00 ", 1200],
    ["-5.25", -525],
    ["-0", 0],
    ["0.1", 10],
    ["0.2", 20],
  ])("%s -> %d", (input, cents) => {
    expect(parseCents(input)).toBe(cents);
  });

  it.each(["", "  ", "abc", "1.234", "1,23", "12,34.5", "1.2.3", "$", ".", "--5", "1e5"])(
    "rejects %j",
    (input) => {
      expect(parseCents(input)).toBeNull();
    },
  );

  it("handles null/undefined", () => {
    expect(parseCents(null)).toBeNull();
    expect(parseCents(undefined)).toBeNull();
  });

  it("avoids float drift (0.1 + 0.2 style inputs)", () => {
    expect(parseCents("0.1")! + parseCents("0.2")!).toBe(30);
    expect(parseCents("19.99")).toBe(1999);
    expect(parseCents("1.15")).toBe(115);
  });
});

describe("formatCents", () => {
  it.each([
    [0, "$0.00"],
    [5, "$0.05"],
    [50, "$0.50"],
    [123456, "$1,234.56"],
    [100000000, "$1,000,000.00"],
    [-525, "-$5.25"],
  ])("%d -> %s", (cents, out) => {
    expect(formatCents(cents)).toBe(out);
  });

  it("omits the symbol on request and round-trips through parseCents", () => {
    for (const c of [0, 1, 99, 100, 123456, -42, 987654321]) {
      expect(parseCents(formatCents(c))).toBe(c);
      expect(parseCents(centsToInput(c))).toBe(c);
    }
    expect(centsToInput(123456)).toBe("1234.56");
  });

  it("rejects non-integers", () => {
    expect(() => formatCents(1.5)).toThrow(TypeError);
  });
});

describe("quantities", () => {
  it.each([
    ["1", 1000],
    ["1.5", 1500],
    ["0.25", 250],
    ["2.125", 2125],
    [".5", 500],
    ["40", 40000],
  ])("parses %s -> %d", (input, milli) => {
    expect(parseQuantityMilli(input)).toBe(milli);
  });

  it.each(["", "-1", "1.2345", "abc", "."])("rejects %j", (input) => {
    expect(parseQuantityMilli(input)).toBeNull();
  });

  it("formats without trailing zeros", () => {
    expect(formatQuantity(1500)).toBe("1.5");
    expect(formatQuantity(2000)).toBe("2");
    expect(formatQuantity(1250)).toBe("1.25");
    expect(formatQuantity(5)).toBe("0.005");
  });
});

describe("lineAmountCents", () => {
  it("multiplies whole quantities exactly", () => {
    expect(lineAmountCents(1000, 8500)).toBe(8500);
    expect(lineAmountCents(40000, 12500)).toBe(500000);
  });

  it("rounds half up to the cent", () => {
    // 1.5 h × $85.33 = $127.995 -> $128.00
    expect(lineAmountCents(1500, 8533)).toBe(12800);
    // 0.333 h × $100 = $33.30
    expect(lineAmountCents(333, 10000)).toBe(3330);
    // 0.001 × $0.50 = $0.0005 -> $0.00 (below half a cent)
    expect(lineAmountCents(1, 50)).toBe(0);
    // 0.005 × $1.00 = $0.005 -> $0.01 (exactly half rounds up)
    expect(lineAmountCents(5, 100)).toBe(1);
    // 0.004 × $1.00 = $0.004 -> $0.00
    expect(lineAmountCents(4, 100)).toBe(0);
  });

  it("rounds negative (discount) lines away from zero symmetrically", () => {
    expect(lineAmountCents(5, -100)).toBe(-1);
    expect(lineAmountCents(1500, -8533)).toBe(-12800);
  });

  it("does not lose precision on large values", () => {
    // 10,000 h × $9,999,999.99
    expect(lineAmountCents(10_000_000, 999_999_999)).toBe(9_999_999_990_000);
  });

  it("zero quantity is zero", () => {
    expect(lineAmountCents(0, 12345)).toBe(0);
  });
});

describe("sumCents", () => {
  it("sums integers and rejects floats", () => {
    expect(sumCents([100, 250, -50])).toBe(300);
    expect(sumCents([])).toBe(0);
    expect(() => sumCents([1, 0.5])).toThrow(TypeError);
  });
});

describe("businessShareCents", () => {
  it("takes a whole-number percent, rounding half up, and the parts add back exactly", () => {
    expect(businessShareCents(200_00, 40)).toBe(80_00);
    expect(businessShareCents(197_29, 40)).toBe(78_92); // 7891.6 -> 7892
    expect(businessShareCents(1, 50)).toBe(1); // 0.5 -> 1
    expect(businessShareCents(1, 49)).toBe(0);
    expect(businessShareCents(123_45, 100)).toBe(123_45);
    for (const [a, p] of [[197_29, 40], [1, 33], [999_99, 7]]) {
      expect(businessShareCents(a, p) + (a - businessShareCents(a, p))).toBe(a);
    }
  });
  it("rejects bad percents", () => {
    expect(() => businessShareCents(100, 101)).toThrow(RangeError);
    expect(() => businessShareCents(100, 12.5)).toThrow(RangeError);
  });
});
