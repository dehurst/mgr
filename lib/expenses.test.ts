import { eq, ne } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import { clients, expenseCategories, expenses, otherIncome } from "@/db/schema";
import { categoryOptions, checkCategory, listExpenses, parseExpenseForm, recentVendors } from "./expenses";
import { listOtherIncome, parseOtherIncomeForm } from "./other-income";

let db: Db;
let catA: number;
let catB: number;

function add(paidOn: string, amountCents: number, categoryId = catA, vendor = "GitHub") {
  db.insert(expenses).values({ paidOn, vendor, categoryId, amountCents, paymentMethod: "business_card" }).run();
}

beforeEach(() => {
  db = openDb(":memory:");
  [catA, catB] = db
    .select()
    .from(expenseCategories)
    .where(ne(expenseCategories.scheduleCLine, "personal"))
    .limit(2)
    .all()
    .map((c) => c.id);
});

describe("parseExpenseForm", () => {
  const raw = {
    paidOn: "2026-03-01",
    vendor: "Adobe",
    categoryId: "1",
    amount: "$59.99",
    paymentMethod: "business_card",
    description: "",
    clientId: "",
  };
  it("parses cents and optional client", () => {
    const r = parseExpenseForm(raw);
    expect(r.ok && r.input).toMatchObject({ amountCents: 5999, clientId: null });
    const r2 = parseExpenseForm({ ...raw, clientId: "3" });
    expect(r2.ok && r2.input.clientId).toBe(3);
  });
  it.each([
    [{ amount: "0" }, "amount"],
    [{ amount: "12.345" }, "amount"],
    [{ amount: "abc" }, "amount"],
    [{ vendor: "" }, "vendor"],
    [{ categoryId: "" }, "categoryId"],
    [{ paidOn: "2026-02-29" }, "paidOn"],
    [{ paymentMethod: "crypto" }, "paymentMethod"],
  ])("rejects %j", (over, field) => {
    const r = parseExpenseForm({ ...raw, ...over });
    expect(!r.ok && r.errors[field]).toBeTruthy();
  });
});

describe("listExpenses", () => {
  it("filters by inclusive date range: Dec 31 is in, Jan 1 is out", () => {
    add("2025-12-31", 100);
    add("2026-01-01", 200);
    add("2026-12-31", 400);
    add("2027-01-01", 800);
    const y = listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" } });
    expect(y.rows.map((r) => r.amountCents).sort()).toEqual([200, 400]);
    expect(y.totalCents).toBe(600);
  });

  it("totals business expenses and shows personal spending separately", () => {
    const personal = db.select().from(expenseCategories).where(eq(expenseCategories.scheduleCLine, "personal")).get()!.id;
    add("2026-02-01", 1000, catA);
    add("2026-02-02", 250, personal, "Target");
    const r = listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" } });
    expect(r.rows).toHaveLength(2);
    expect(r.totalCents).toBe(1000);
    expect(r.personalCents).toBe(250);
  });

  it("filters by category and totals the filtered rows only", () => {
    add("2026-02-01", 1000, catA);
    add("2026-02-02", 2500, catB);
    const r = listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" }, categoryId: catB });
    expect(r.rows).toHaveLength(1);
    expect(r.totalCents).toBe(2500);
  });

  it("keeps archived categories on old expenses", () => {
    add("2026-02-01", 1000, catA);
    db.update(expenseCategories).set({ archivedAt: "2026-03-01T00:00:00Z", name: "Renamed" }).where(eq(expenseCategories.id, catA)).run();
    const r = listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" } });
    expect(r.rows[0].categoryName).toBe("Renamed");
  });
});

describe("categories", () => {
  it("archived categories can't be used for new expenses but stay on existing ones", () => {
    db.update(expenseCategories).set({ archivedAt: "2026-03-01T00:00:00Z" }).where(eq(expenseCategories.id, catA)).run();
    expect(checkCategory(db, catA)).toMatch(/archived/);
    expect(checkCategory(db, catA, catA)).toBeNull();
    expect(checkCategory(db, 99999)).toMatch(/no longer exists/);
    expect(categoryOptions(db).some((c) => c.id === catA)).toBe(false);
    expect(categoryOptions(db, catA).some((c) => c.id === catA)).toBe(true);
  });
});

describe("recentVendors", () => {
  it("lists distinct vendors, most recent first", () => {
    add("2026-01-01", 100, catA, "Adobe");
    add("2026-03-01", 100, catA, "GitHub");
    add("2026-02-01", 100, catA, "Adobe");
    expect(recentVendors(db)).toEqual(["GitHub", "Adobe"]);
  });
});

describe("other income", () => {
  it("parses and validates", () => {
    const ok = parseOtherIncomeForm({ receivedOn: "2026-03-01", source: "QBO Jan–Sep", clientId: "", amount: "1,200", notes: "" }, "2026-10-03");
    expect(ok.ok && ok.input.amountCents).toBe(120000);
    const future = parseOtherIncomeForm({ receivedOn: "2026-10-04", source: "x", clientId: "", amount: "1", notes: "" }, "2026-10-03");
    expect(future.ok).toBe(false);
  });

  it("lists within range, excluding voided rows", () => {
    const clientId = db.insert(clients).values({ name: "Acme" }).returning().get().id;
    db.insert(otherIncome).values({ receivedOn: "2026-01-01", source: "a", amountCents: 100, clientId }).run();
    db.insert(otherIncome).values({ receivedOn: "2026-06-01", source: "b", amountCents: 200, voidedAt: "x" }).run();
    db.insert(otherIncome).values({ receivedOn: "2027-01-01", source: "c", amountCents: 400 }).run();
    const r = listOtherIncome(db, { from: "2026-01-01", to: "2026-12-31" });
    expect(r.totalCents).toBe(100);
    expect(r.rows[0].clientName).toBe("Acme");
  });
});
