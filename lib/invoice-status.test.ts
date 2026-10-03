import { describe, expect, it } from "vitest";
import { balanceCents, deriveStatus, invoiceTotalCents, isOverdue, type StatusInput } from "./invoice-status";

const base: StatusInput = {
  sentAt: "2026-01-02T15:00:00.000Z",
  voidedAt: null,
  dueOn: "2026-01-16",
  totalCents: 100_00,
  paidCents: 0,
};

describe("deriveStatus", () => {
  it("draft when never sent, even if past due", () => {
    expect(deriveStatus({ ...base, sentAt: null }, "2026-03-01")).toBe("draft");
  });

  it("void wins over everything", () => {
    expect(deriveStatus({ ...base, voidedAt: "2026-01-05T00:00:00Z", paidCents: 100_00 }, "2026-01-10")).toBe("void");
    expect(deriveStatus({ ...base, sentAt: null, voidedAt: "2026-01-05T00:00:00Z" }, "2026-01-10")).toBe("void");
  });

  it("sent when unpaid and not yet due", () => {
    expect(deriveStatus(base, "2026-01-10")).toBe("sent");
  });

  it("due today is not overdue; the day after is", () => {
    expect(deriveStatus(base, "2026-01-16")).toBe("sent");
    expect(deriveStatus(base, "2026-01-17")).toBe("overdue");
  });

  it("overdue across a year boundary", () => {
    const dec = { ...base, dueOn: "2026-12-31" };
    expect(deriveStatus(dec, "2026-12-31")).toBe("sent");
    expect(deriveStatus(dec, "2027-01-01")).toBe("overdue");
  });

  it("partially paid", () => {
    expect(deriveStatus({ ...base, paidCents: 40_00 }, "2026-01-10")).toBe("partially_paid");
  });

  it("partially paid and past due reports overdue, isOverdue confirms", () => {
    const inv = { ...base, paidCents: 40_00 };
    expect(deriveStatus(inv, "2026-02-01")).toBe("overdue");
    expect(isOverdue(inv, "2026-02-01")).toBe(true);
  });

  it("paid in full, even when paid late", () => {
    expect(deriveStatus({ ...base, paidCents: 100_00 }, "2026-02-01")).toBe("paid");
  });

  it("a zero-total sent invoice counts as paid", () => {
    expect(deriveStatus({ ...base, totalCents: 0 }, "2026-01-10")).toBe("paid");
  });
});

describe("balanceCents", () => {
  it("is total minus payments for sent invoices", () => {
    expect(balanceCents({ ...base, paidCents: 25_50 })).toBe(74_50);
  });
  it("is zero for drafts and voids", () => {
    expect(balanceCents({ ...base, sentAt: null })).toBe(0);
    expect(balanceCents({ ...base, voidedAt: "2026-01-05T00:00:00Z" })).toBe(0);
  });
  it("never goes negative", () => {
    expect(balanceCents({ ...base, paidCents: 120_00 })).toBe(0);
  });
});

describe("invoiceTotalCents", () => {
  it("sums individually rounded lines", () => {
    // 1.5 h × $85.33 = 127.995 -> 128.00 ; 0.25 h × $85.33 = 21.3325 -> 21.33
    expect(
      invoiceTotalCents([
        { quantityMilli: 1500, unitPriceCents: 8533 },
        { quantityMilli: 250, unitPriceCents: 8533 },
      ]),
    ).toBe(128_00 + 21_33);
  });
  it("is zero with no lines", () => {
    expect(invoiceTotalCents([])).toBe(0);
  });
});
