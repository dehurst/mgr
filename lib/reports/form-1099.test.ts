import { describe, expect, it } from "vitest";
import type { Payee } from "@/db/schema";
import { countsToward1099, form1099Rows, isExemptPayee, maskedTin, threshold1099, type PayeePaymentRow } from "./form-1099";

function payee(id: number, over: Partial<Payee> = {}): Payee {
  return {
    id,
    name: `Payee ${id}`,
    businessName: "",
    email: "",
    address: "1 Main St\nRaleigh, NC 27601",
    taxClassification: "individual",
    isAttorney: false,
    tinType: "ssn",
    tinLast4: "1234",
    w9ReceivedOn: "2026-01-02",
    notes: "",
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

let nextId = 1;
function pay(payeeId: number, date: string, amountCents: number, over: Partial<PayeePaymentRow> = {}): PayeePaymentRow {
  return { id: nextId++, payeeId, date, amountCents, businessPct: 100, scheduleCLine: "11", paymentMethod: "check", ...over };
}

describe("threshold1099", () => {
  it("is $600 through 2025 and $2,000 from 2026 (estimate once inflation adjustments start)", () => {
    expect(threshold1099(2025)).toEqual({ cents: 600_00, isEstimate: false });
    expect(threshold1099(2026)).toEqual({ cents: 2_000_00, isEstimate: false });
    expect(threshold1099(2027).isEstimate).toBe(true);
  });
});

describe("form1099Rows", () => {
  it("files at exactly the threshold, not a cent below", () => {
    const rows = form1099Rows([payee(1), payee(2)], [pay(1, "2026-03-01", 2_000_00), pay(2, "2026-03-01", 1_999_99)], 2026);
    expect(rows.find((r) => r.payee.id === 1)!.status).toBe("file");
    expect(rows.find((r) => r.payee.id === 2)!.status).toBe("under_threshold");
    // The same $700 was over the 2025 threshold.
    expect(form1099Rows([payee(3)], [pay(3, "2025-12-31", 700_00)], 2025)[0].status).toBe("file");
  });

  it("leaves card and Venmo/PayPal goods & services payments off box 1; friends & family counts", () => {
    const [r] = form1099Rows(
      [payee(1)],
      [
        pay(1, "2026-01-05", 1_500_00, { paymentMethod: "business_card" }),
        pay(1, "2026-02-05", 1_500_00, { paymentMethod: "p2p_goods" }),
        pay(1, "2026-03-05", 1_500_00, { paymentMethod: "p2p_personal" }),
        pay(1, "2026-04-05", 500_00, { paymentMethod: "bank_transfer" }),
      ],
      2026,
    );
    expect(r.reportableCents).toBe(2_000_00);
    expect(r.networkCents).toBe(3_000_00);
    expect(r.status).toBe("file");
    expect(countsToward1099("cash")).toBe(true);
    expect(countsToward1099("personal_card")).toBe(false);
  });

  it("counts only the business share; personal-category payments don't count", () => {
    const [r] = form1099Rows(
      [payee(1)],
      [pay(1, "2026-01-05", 3_000_00, { businessPct: 50 }), pay(1, "2026-02-05", 5_000_00, { scheduleCLine: "personal" })],
      2026,
    );
    expect(r.reportableCents).toBe(1_500_00);
    expect(r.paymentCount).toBe(1);
    expect(r.status).toBe("under_threshold");
  });

  it("skips corporations unless they're attorneys; unknown classification still files", () => {
    const big = (id: number) => pay(id, "2026-05-01", 5_000_00);
    const rows = form1099Rows(
      [payee(1, { taxClassification: "corporation" }), payee(2, { taxClassification: "corporation", isAttorney: true }), payee(3, { taxClassification: null })],
      [big(1), big(2), big(3)],
      2026,
    );
    const status = (id: number) => rows.find((r) => r.payee.id === id)!.status;
    expect(status(1)).toBe("exempt");
    expect(status(2)).toBe("file");
    expect(status(3)).toBe("file");
    expect(isExemptPayee({ taxClassification: "partnership", isAttorney: false })).toBe(false);
  });

  it("lists what's missing before a form can be filed", () => {
    const [r] = form1099Rows([payee(1, { w9ReceivedOn: null, tinLast4: null, address: " " })], [pay(1, "2026-05-01", 5_000_00)], 2026);
    expect(r.missing).toEqual(["W-9", "tax ID", "address"]);
    const [under] = form1099Rows([payee(2, { w9ReceivedOn: null })], [pay(2, "2026-05-01", 100)], 2026);
    expect(under.missing).toEqual([]);
  });

  it("hides archived payees with no payments that year; sorts by amount", () => {
    const rows = form1099Rows([payee(1, { archivedAt: "x" }), payee(2), payee(3)], [pay(2, "2026-01-01", 100), pay(3, "2026-01-01", 900)], 2026);
    expect(rows.map((r) => r.payee.id)).toEqual([3, 2]);
  });
});

describe("maskedTin", () => {
  it("shows only the last 4 digits in the SSN or EIN shape", () => {
    expect(maskedTin({ tinType: "ssn", tinLast4: "6789" })).toBe("XXX-XX-6789");
    expect(maskedTin({ tinType: "ein", tinLast4: "6789" })).toBe("XX-XXX6789");
    expect(maskedTin({ tinType: null, tinLast4: null })).toBe("");
  });
});
