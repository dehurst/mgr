import { eq, ne } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import { expenseCategories, expenses } from "@/db/schema";
import { importContext, listImports, saveImport, undoImport, type ImportRow } from "./expense-import";
import { parseStatement, suggestImport } from "./import";
import { listExpenses } from "./expenses";

let db: Db;
let cat: number;
const row = (over: Partial<ImportRow> = {}): ImportRow => ({ date: "2025-03-01", vendor: "Adobe", description: "ADOBE *CC", amountCents: 59_99, categoryId: cat, businessPct: 100, ...over });

beforeEach(async () => {
  db = await openDb(":memory:");
  cat = (await db.select().from(expenseCategories).where(ne(expenseCategories.scheduleCLine, "personal")).get())!.id;
});

describe("saveImport", () => {
  it("saves every row under one import, with the payment method; undo removes exactly that import", async () => {
    await db.insert(expenses).values({ paidOn: "2025-03-02", vendor: "Typed by hand", categoryId: cat, amountCents: 10_00, paymentMethod: "cash" }).run();
    const r = await saveImport(db, "amex-2025.csv", "business_card", [row(), row({ date: "2025-03-05", vendor: "Staples", amountCents: -15_00 })]);
    expect(r).toMatchObject({ ok: true, count: 2 });
    const [imp] = await listImports(db);
    expect(imp).toMatchObject({ fileName: "amex-2025.csv", count: 2, totalCents: 44_99, from: "2025-03-01", to: "2025-03-05" });
    const all = await listExpenses(db, { range: { from: "2025-01-01", to: "2025-12-31" } });
    expect(all.rows).toHaveLength(3);
    expect(all.rows.filter((e) => e.paymentMethod === "business_card")).toHaveLength(2);

    await undoImport(db, imp.id);
    const left = await db.select().from(expenses).all();
    expect(left.map((e) => e.vendor)).toEqual(["Typed by hand"]);
    expect(await listImports(db)).toEqual([]);
  });

  it("saves nothing if any row is bad", async () => {
    const archived = (await db.insert(expenseCategories).values({ name: "Old", scheduleCLine: "18", archivedAt: "2025-01-01T00:00:00Z" }).returning().get()).id;
    for (const [bad, msg] of [
      [{ date: "2025-02-30" }, /bad date/],
      [{ vendor: " " }, /vendor/],
      [{ amountCents: 0 }, /amount/],
      [{ amountCents: 1.5 }, /amount/],
      [{ categoryId: archived }, /category/],
      [{ businessPct: 0 }, /business %/],
    ] as const) {
      const r = await saveImport(db, "f.csv", "business_card", [row(), row(bad as Partial<ImportRow>)]);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toMatch(msg);
    }
    expect(await saveImport(db, "f.csv", "crypto", [row()])).toMatchObject({ ok: false });
    expect(await saveImport(db, "f.csv", "business_card", [])).toMatchObject({ ok: false });
    expect(await db.select().from(expenses).all()).toHaveLength(0);
  });
});

describe("importing the same statement twice", () => {
  it("the second time, every row is flagged as a duplicate and starts unchecked", async () => {
    const csv = "Date,Description,Amount\n03/01/2025,ADOBE *CREATIVE CLD,59.99\n03/05/2025,VERIZON WIRELESS,120.00\n";
    const first = parseStatement(csv);
    const ctx1 = await importContext(db, first.lines);
    const s1 = suggestImport(first.lines, ctx1.history, ctx1.existing);
    expect(s1.every((s) => s.include)).toBe(true);
    await saveImport(db, "a.csv", "business_card", s1.map((s) => ({ date: s.date, vendor: s.vendor, description: s.description, amountCents: s.amountCents, categoryId: cat, businessPct: 40 })));

    const ctx2 = await importContext(db, first.lines);
    const s2 = suggestImport(first.lines, ctx2.history, ctx2.existing);
    expect(s2.map((s) => s.include)).toEqual([false, false]);
    // ...and a later statement learns the category and % from the first import.
    const later = parseStatement("Date,Description,Amount\n04/05/2025,VERIZON WIRELESS,120.00\n");
    const ctx3 = await importContext(db, later.lines);
    expect(suggestImport(later.lines, ctx3.history, ctx3.existing)[0]).toMatchObject({ include: true, vendor: "Verizon Wireless", categoryId: cat, businessPct: 40 });
    expect((await db.select().from(expenses).where(eq(expenses.vendor, "Verizon Wireless")).all()).length).toBe(1);
  });
});
