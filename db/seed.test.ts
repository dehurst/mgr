import { describe, expect, it } from "vitest";
import { listInvoiceSummaries } from "@/lib/invoices";
import { computeAging } from "@/lib/reports/aging";
import { loadExpenses, loadIncome } from "@/lib/reports/data";
import { computePnl } from "@/lib/reports/pnl";
import { openDb } from "./index";
import { hasData, seedDemo } from "./seed";

describe("demo seed", () => {
  it("creates every invoice status and reports that reconcile", async () => {
    const db = await openDb(":memory:");
    expect(await hasData(db)).toBe(false);
    await seedDemo(db, "2026-10-03");
    expect(await hasData(db)).toBe(true);
    const statuses = new Set((await listInvoiceSummaries(db, "2026-10-03")).map((s) => s.status));
    expect([...statuses].sort()).toEqual(["draft", "overdue", "paid", "sent", "void"]);
    const all = { from: "2000-01-01", to: "2099-12-31" };
    const pnl = computePnl(await loadIncome(db, all), await loadExpenses(db, all));
    expect(pnl.expensesCents).toBe(6599_77); // includes $2,500 paid to the demo contractor
    expect(pnl.incomeCents).toBeGreaterThan(0);
    expect(computeAging(await listInvoiceSummaries(db, "2026-10-03"), "2026-10-03").totalCents).toBeGreaterThan(0);
  });
});
