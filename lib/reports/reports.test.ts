import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import { clients, expenseCategories, expenses, invoices, otherIncome, payments } from "@/db/schema";
import { toCsv } from "@/lib/csv";
import { createInvoice, listInvoiceSummaries } from "@/lib/invoices";
import { markSent, recordPayment } from "@/lib/payments";
import { agingBucket, computeAging } from "./aging";
import { loadExpenses, loadIncome } from "./data";
import { expenseReport } from "./expenses";
import { incomeByClient, NO_CLIENT } from "./income-by-client";
import { computePnl } from "./pnl";
import { halfCents, taxSummary } from "./tax";

let db: Db;
let acme: number;
let beta: number;
const cat: Record<string, number> = {};
const Y2026 = { from: "2026-01-01", to: "2026-12-31" };

function invoice(clientId: number, cents: number, issuedOn: string, dueOn: string, sentOn: string | null = issuedOn) {
  const r = createInvoice(db, {
    clientId,
    number: `INV-${Math.random().toString(36).slice(2, 8)}`,
    issuedOn,
    dueOn,
    notes: "",
    lines: [{ description: "Work", quantityMilli: 1000, unitPriceCents: cents }],
  });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  if (sentOn) markSent(db, r.id, sentOn, "2099-01-01");
  return r.id;
}

function pay(invoiceId: number, cents: number, receivedOn: string) {
  const r = recordPayment(db, invoiceId, { receivedOn, amountCents: cents, method: "check", reference: "", notes: "" });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
}

function expense(paidOn: string, cents: number, category: string, vendor = "Vendor") {
  db.insert(expenses).values({ paidOn, vendor, categoryId: cat[category], amountCents: cents, paymentMethod: "business_card" }).run();
}

beforeEach(() => {
  db = openDb(":memory:");
  for (const c of db.select().from(expenseCategories).all()) cat[c.name] = c.id;
  acme = db.insert(clients).values({ name: "Acme" }).returning().get().id;
  beta = db.insert(clients).values({ name: "Beta" }).returning().get().id;
});

describe("cash-basis income", () => {
  it("counts payments on the date received, not the invoice date; Dec 31 vs Jan 1", () => {
    const inv = invoice(acme, 3000_00, "2026-12-01", "2026-12-31");
    pay(inv, 1000_00, "2026-12-31");
    pay(inv, 2000_00, "2027-01-01");
    expect(computePnl(loadIncome(db, Y2026), []).incomeCents).toBe(1000_00);
    expect(computePnl(loadIncome(db, { from: "2027-01-01", to: "2027-12-31" }), []).incomeCents).toBe(2000_00);
  });

  it("excludes voided payments, payments on voided invoices, and voided other income", () => {
    const inv = invoice(acme, 500_00, "2026-03-01", "2026-03-16");
    pay(inv, 500_00, "2026-03-10");
    db.update(payments).set({ voidedAt: "2026-03-11T00:00:00Z" }).run();
    const inv2 = invoice(acme, 700_00, "2026-03-01", "2026-03-16");
    pay(inv2, 700_00, "2026-03-10");
    db.update(invoices).set({ voidedAt: "2026-03-12T00:00:00Z" }).where(eq(invoices.id, inv2)).run(); // forced, bypassing the UI guard
    db.insert(otherIncome).values({ receivedOn: "2026-04-01", source: "x", amountCents: 9_00, voidedAt: "y" }).run();
    db.insert(otherIncome).values({ receivedOn: "2026-04-01", source: "QBO", amountCents: 1200_00 }).run();
    const p = computePnl(loadIncome(db, Y2026), []);
    expect(p).toMatchObject({ invoicePaymentsCents: 0, otherIncomeCents: 1200_00, incomeCents: 1200_00 });
  });

  it("drafts and unpaid invoices are not income", () => {
    invoice(acme, 999_00, "2026-03-01", "2026-03-16", null);
    invoice(acme, 888_00, "2026-03-01", "2026-03-16");
    expect(computePnl(loadIncome(db, Y2026), []).incomeCents).toBe(0);
  });
});

describe("P&L", () => {
  it("income minus expenses by category = net, and supports a loss", () => {
    const inv = invoice(acme, 5000_00, "2026-02-01", "2026-02-16");
    pay(inv, 5000_00, "2026-02-10");
    expense("2026-01-05", 59_99, "Software & subscriptions");
    expense("2026-01-06", 20_01, "Software & subscriptions");
    expense("2026-03-01", 412_30, "Travel");
    const p = computePnl(loadIncome(db, Y2026), loadExpenses(db, Y2026));
    expect(p.expensesByCategory.map((c) => [c.name, c.cents])).toEqual([
      ["Travel", 412_30],
      ["Software & subscriptions", 80_00],
    ]);
    expect(p.expensesCents).toBe(492_30);
    expect(p.netCents).toBe(5000_00 - 492_30);
    expense("2026-04-01", 10000_00, "Contract labor");
    expect(computePnl(loadIncome(db, Y2026), loadExpenses(db, Y2026)).netCents).toBe(5000_00 - 10492_30);
  });

  it("expense date boundaries are inclusive", () => {
    expense("2025-12-31", 1, "Supplies");
    expense("2026-01-01", 10, "Supplies");
    expense("2026-12-31", 100, "Supplies");
    expense("2027-01-01", 1000, "Supplies");
    expect(computePnl([], loadExpenses(db, Y2026)).expensesCents).toBe(110);
  });
});

describe("reconciliation", () => {
  it("P&L expenses == expense report total == tax summary total, for the same range", () => {
    const names = Object.keys(cat);
    let n = 0;
    for (const d of ["2025-12-31", "2026-01-01", "2026-06-15", "2026-12-31", "2027-01-01"]) {
      for (const name of names) expense(d, 1_00 + 37 * n++, name, n % 3 ? "GitHub" : "github");
    }
    // Archive and rename one category: its expenses must still be counted everywhere.
    db.update(expenseCategories).set({ archivedAt: "2026-07-01T00:00:00Z", name: "Old name" }).where(eq(expenseCategories.id, cat.Travel)).run();
    for (const range of [Y2026, { from: "2026-06-01", to: "2026-06-30" }, { from: "2025-01-01", to: "2027-12-31" }]) {
      const rows = loadExpenses(db, range);
      const pnl = computePnl([], rows).expensesCents;
      const report = expenseReport(rows);
      const tax = taxSummary([], rows).totalExpensesCents;
      expect(report.totalCents).toBe(pnl);
      expect(tax).toBe(pnl);
      expect(report.byVendor.reduce((s, v) => s + v.cents, 0)).toBe(pnl);
      expect(report.byCategory.reduce((s, c) => s + c.cents, 0)).toBe(pnl);
    }
  });
});

describe("expense report", () => {
  it("groups vendors case-insensitively under the most common spelling", () => {
    expense("2026-01-01", 100, "Supplies", "Staples");
    expense("2026-01-02", 200, "Supplies", "staples ");
    expense("2026-01-03", 300, "Supplies", "Staples");
    expense("2026-01-04", 50, "Supplies", "Amazon");
    const r = expenseReport(loadExpenses(db, Y2026));
    expect(r.byVendor).toEqual([
      { vendor: "Staples", cents: 600, count: 3 },
      { vendor: "Amazon", cents: 50, count: 1 },
    ]);
  });
});

describe("A/R aging", () => {
  it.each([
    [-5, "current"],
    [0, "current"],
    [1, "1-30"],
    [30, "1-30"],
    [31, "31-60"],
    [60, "31-60"],
    [61, "61-90"],
    [90, "61-90"],
    [91, "90+"],
  ] as const)("%d days past due -> %s", (days, bucket) => {
    expect(agingBucket(days)).toBe(bucket);
  });

  it("buckets open balances only, net of partial payments", () => {
    const today = "2026-10-03";
    const a = invoice(acme, 1000_00, "2026-09-20", "2026-10-03"); // due today -> current
    const b = invoice(acme, 1000_00, "2026-08-01", "2026-09-02"); // 31 days -> 31-60
    pay(b, 400_00, "2026-09-15");
    const c = invoice(beta, 500_00, "2026-05-01", "2026-06-01"); // 124 days -> 90+
    const paid = invoice(beta, 300_00, "2026-05-01", "2026-06-01");
    pay(paid, 300_00, "2026-06-05");
    invoice(beta, 999_00, "2026-01-01", "2026-01-15", null); // draft: excluded
    const aging = computeAging(listInvoiceSummaries(db, today), today);
    expect(aging.rows.map((r) => [r.id, r.bucket, r.balanceCents])).toEqual([
      [c, "90+", 500_00],
      [b, "31-60", 600_00],
      [a, "current", 1000_00],
    ]);
    expect(aging.buckets).toEqual({ current: 1000_00, "1-30": 0, "31-60": 600_00, "61-90": 0, "90+": 500_00 });
    expect(aging.totalCents).toBe(2100_00);
    expect(aging.overdueCents).toBe(1100_00);
  });
});

describe("income by client", () => {
  it("combines invoice payments and client-linked other income; unlinked income goes last", () => {
    const inv = invoice(acme, 1000_00, "2026-02-01", "2026-02-16");
    pay(inv, 1000_00, "2026-02-10");
    db.insert(otherIncome).values({ receivedOn: "2026-03-31", source: "QBO Mar", clientId: beta, amountCents: 4500_00 }).run();
    db.insert(otherIncome).values({ receivedOn: "2026-04-01", source: "Interest", amountCents: 3_21 }).run();
    const r = incomeByClient(loadIncome(db, Y2026));
    expect(r.clients.map((c) => [c.clientName, c.invoicePaymentsCents, c.otherIncomeCents, c.totalCents])).toEqual([
      ["Beta", 0, 4500_00, 4500_00],
      ["Acme", 1000_00, 0, 1000_00],
      [NO_CLIENT, 0, 3_21, 3_21],
    ]);
    expect(r.totalCents).toBe(5503_21);
    expect(r.totalCents).toBe(computePnl(loadIncome(db, Y2026), []).incomeCents);
  });
});

describe("tax summary", () => {
  it("rolls up by Schedule C line in form order with the 50% meals figure", () => {
    expense("2026-01-10", 59_99, "Software & subscriptions");
    expense("2026-01-11", 12_00, "Hosting & domains");
    expense("2026-02-01", 101_01, "Meals (50% deductible)");
    expense("2026-03-01", 200_00, "Advertising & marketing");
    const t = taxSummary([], loadExpenses(db, Y2026));
    expect(t.lines.map((l) => [l.line, l.cents])).toEqual([
      ["8", 200_00],
      ["24b", 101_01],
      ["27a", 71_99],
    ]);
    expect(t.lines.find((l) => l.line === "27a")!.categories.map((c) => c.name)).toEqual(["Software & subscriptions", "Hosting & domains"]);
    expect(t.mealsCents).toBe(101_01);
    expect(t.mealsDeductibleCents).toBe(50_51);
  });

  it("rounds the meals half up", () => {
    expect(halfCents(101)).toBe(51);
    expect(halfCents(100)).toBe(50);
    expect(halfCents(0)).toBe(0);
  });

  it("gross receipts equal P&L income for the year", () => {
    const inv = invoice(acme, 1000_00, "2026-02-01", "2026-02-16");
    pay(inv, 1000_00, "2026-12-31");
    const income = loadIncome(db, Y2026);
    expect(taxSummary(income, []).grossReceiptsCents).toBe(computePnl(income, []).incomeCents);
  });
});

describe("CSV", () => {
  it("quotes commas, quotes, newlines and neutralizes formulas", () => {
    expect(toCsv([["a,b", 'say "hi"', "line\nbreak", "=SUM(A1)", "-12.50", null]])).toBe(
      '"a,b","say ""hi""","line\nbreak",\'=SUM(A1),-12.50,\r\n',
    );
  });
});
