import { eq, ne } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import { clients, expenseCategories, expenses, otherIncome } from "@/db/schema";
import { applyBusinessPctToCategory, categoryOptions, checkCategory, expenseListCsv, listExpenses, parseExpenseForm, recentVendors } from "./expenses";
import { listOtherIncome, parseOtherIncomeForm } from "./other-income";

let db: Db;
let catA: number;
let catB: number;

async function add(paidOn: string, amountCents: number, categoryId = catA, vendor = "GitHub") {
  await db.insert(expenses).values({ paidOn, vendor, categoryId, amountCents, paymentMethod: "business_card" }).run();
}

beforeEach(async () => {
  db = await openDb(":memory:");
  [catA, catB] = (await db
    .select()
    .from(expenseCategories)
    .where(ne(expenseCategories.scheduleCLine, "personal"))
    .limit(2)
    .all())
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
    payeeId: "",
    businessPct: "",
  };
  it("parses cents, optional client, and business % (blank = 100)", async () => {
    const r = parseExpenseForm(raw);
    expect(r.ok && r.input).toMatchObject({ amountCents: 5999, clientId: null, businessPct: 100 });
    const pct = parseExpenseForm({ ...raw, businessPct: "40%" });
    expect(pct.ok && pct.input.businessPct).toBe(40);
    const r2 = parseExpenseForm({ ...raw, clientId: "3" });
    expect(r2.ok && r2.input.clientId).toBe(3);
  });
  it("accepts refunds: the checkbox or a minus sign makes the amount negative", () => {
    const box = parseExpenseForm({ ...raw, amount: "25.00", refund: "on" });
    expect(box.ok && box.input.amountCents).toBe(-25_00);
    const typed = parseExpenseForm({ ...raw, amount: "-25" });
    expect(typed.ok && typed.input.amountCents).toBe(-25_00);
    const both = parseExpenseForm({ ...raw, amount: "-25", refund: "on" });
    expect(both.ok && both.input.amountCents).toBe(-25_00);
    expect(parseExpenseForm({ ...raw, amount: "0", refund: "on" }).ok).toBe(false);
  });
  it.each([
    [{ amount: "0" }, "amount"],
    [{ amount: "12.345" }, "amount"],
    [{ amount: "abc" }, "amount"],
    [{ vendor: "" }, "vendor"],
    [{ categoryId: "" }, "categoryId"],
    [{ paidOn: "2026-02-29" }, "paidOn"],
    [{ paymentMethod: "crypto" }, "paymentMethod"],
    [{ businessPct: "0" }, "businessPct"],
    [{ businessPct: "101" }, "businessPct"],
    [{ businessPct: "40.5" }, "businessPct"],
  ])("rejects %j", async (over, field) => {
    const r = parseExpenseForm({ ...raw, ...over });
    expect(!r.ok && r.errors[field]).toBeTruthy();
  });
});

describe("listExpenses", () => {
  it("filters by inclusive date range: Dec 31 is in, Jan 1 is out", async () => {
    await add("2025-12-31", 100);
    await add("2026-01-01", 200);
    await add("2026-12-31", 400);
    await add("2027-01-01", 800);
    const y = await listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" } });
    expect(y.rows.map((r) => r.amountCents).sort()).toEqual([200, 400]);
    expect(y.totalCents).toBe(600);
  });

  it("totals business expenses and shows personal spending separately", async () => {
    const personal = (await db.select().from(expenseCategories).where(eq(expenseCategories.scheduleCLine, "personal")).get())!.id;
    await add("2026-02-01", 1000, catA);
    await add("2026-02-02", 250, personal, "Target");
    const r = await listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" } });
    expect(r.rows).toHaveLength(2);
    expect(r.totalCents).toBe(1000);
    expect(r.personalCents).toBe(250);
  });

  it("filters by category and totals the filtered rows only", async () => {
    await add("2026-02-01", 1000, catA);
    await add("2026-02-02", 2500, catB);
    const r = await listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" }, categoryId: catB });
    expect(r.rows).toHaveLength(1);
    expect(r.totalCents).toBe(2500);
  });

  it("keeps archived categories on old expenses", async () => {
    await add("2026-02-01", 1000, catA);
    await db.update(expenseCategories).set({ archivedAt: "2026-03-01T00:00:00Z", name: "Renamed" }).where(eq(expenseCategories.id, catA)).run();
    const r = await listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" } });
    expect(r.rows[0].categoryName).toBe("Renamed");
  });
});

describe("categories", () => {
  it("archived categories can't be used for new expenses but stay on existing ones", async () => {
    await db.update(expenseCategories).set({ archivedAt: "2026-03-01T00:00:00Z" }).where(eq(expenseCategories.id, catA)).run();
    expect(await checkCategory(db, catA)).toMatch(/archived/);
    expect(await checkCategory(db, catA, catA)).toBeNull();
    expect(await checkCategory(db, 99999)).toMatch(/no longer exists/);
    expect((await categoryOptions(db)).some((c) => c.id === catA)).toBe(false);
    expect((await categoryOptions(db, catA)).some((c) => c.id === catA)).toBe(true);
  });
});

describe("applyBusinessPctToCategory", () => {
  it("updates only that category's expenses and reports how many changed", async () => {
    await add("2026-01-01", 100, catA);
    await add("2026-02-01", 100, catA);
    await add("2026-02-01", 100, catB);
    expect(await applyBusinessPctToCategory(db, catA, 40)).toBe(2);
    expect(await applyBusinessPctToCategory(db, catA, 40)).toBe(0); // already 40
    const pcts = await db.select({ c: expenses.categoryId, p: expenses.businessPct }).from(expenses).all();
    expect(pcts.filter((x) => x.c === catA).every((x) => x.p === 40)).toBe(true);
    expect(pcts.find((x) => x.c === catB)!.p).toBe(100);
    const r = await listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" } });
    expect(r.totalCents).toBe(40 + 40 + 100);
    expect(r.personalCents).toBe(60 + 60);
  });
});

describe("recentVendors", () => {
  it("lists distinct vendors, most recent first", async () => {
    await add("2026-01-01", 100, catA, "Adobe");
    await add("2026-03-01", 100, catA, "GitHub");
    await add("2026-02-01", 100, catA, "Adobe");
    expect(await recentVendors(db)).toEqual(["GitHub", "Adobe"]);
  });
});

describe("other income", () => {
  it("parses and validates", async () => {
    const ok = parseOtherIncomeForm({ receivedOn: "2026-03-01", source: "QBO Jan–Sep", clientId: "", amount: "1,200", notes: "" }, "2026-10-03");
    expect(ok.ok && ok.input.amountCents).toBe(120000);
    const future = parseOtherIncomeForm({ receivedOn: "2026-10-04", source: "x", clientId: "", amount: "1", notes: "" }, "2026-10-03");
    expect(future.ok).toBe(false);
  });

  it("lists within range, excluding voided rows", async () => {
    const clientId = (await db.insert(clients).values({ name: "Acme" }).returning().get()).id;
    await db.insert(otherIncome).values({ receivedOn: "2026-01-01", source: "a", amountCents: 100, clientId }).run();
    await db.insert(otherIncome).values({ receivedOn: "2026-06-01", source: "b", amountCents: 200, voidedAt: "x" }).run();
    await db.insert(otherIncome).values({ receivedOn: "2027-01-01", source: "c", amountCents: 400 }).run();
    const r = await listOtherIncome(db, { from: "2026-01-01", to: "2026-12-31" });
    expect(r.totalCents).toBe(100);
    expect(r.rows[0].clientName).toBe("Acme");
  });
});

describe("expenseListCsv", () => {
  it("exports the filtered rows with the split, and totals that match the page", async () => {
    const personal = (await db.select().from(expenseCategories).where(eq(expenseCategories.scheduleCLine, "personal")).get())!.id;
    await add("2026-02-01", 197_29, catA, "Verizon");
    await db.update(expenses).set({ businessPct: 40 }).where(eq(expenses.vendor, "Verizon")).run();
    await add("2026-02-02", 25_00, personal, "Target");
    await add("2026-12-31", 10_00, catB, "Last day");
    await add("2027-01-01", 99_00, catA, "Next year");
    const list = await listExpenses(db, { range: { from: "2026-01-01", to: "2026-12-31" } });
    const csv = expenseListCsv(list, "Expenses 2026");
    const [, , header, ...rest] = csv;
    expect(header.slice(6, 10)).toEqual(["Amount paid", "Business %", "Business amount", "Personal amount"]);
    const body = rest.slice(0, list.rows.length);
    expect(body.map((r) => r[1])).toEqual(["Last day", "Target", "Verizon"]); // Dec 31 in, Jan 1 out
    expect(body.find((r) => r[1] === "Verizon")!.slice(6, 10)).toEqual(["197.29", 40, "78.92", "118.37"]);
    expect(body.find((r) => r[1] === "Target")!.slice(6, 10)).toEqual(["25.00", 0, "0.00", "25.00"]);
    // Each row's parts add back to what was paid, and the totals equal the page's.
    for (const r of body) expect(Math.round(Number(r[8]) * 100) + Math.round(Number(r[9]) * 100)).toBe(Math.round(Number(r[6]) * 100));
    expect(csv.at(-2)![8]).toBe("88.92");
    expect(csv.at(-1)![9]).toBe("143.37");
    expect(list.totalCents).toBe(88_92);
    expect(list.personalCents).toBe(143_37);
  });
});
