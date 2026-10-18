import { strFromU8, unzipSync } from "fflate";
import { beforeAll, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import type { Cell } from "./csv";
import { seedDemo } from "@/db/seed";
import { exportTables, exportZip } from "./export";

describe("export all data", () => {
  let db: Db;
  let tables: Record<string, Cell[][]>;
  beforeAll(async () => {
    db = await openDb(":memory:");
    await seedDemo(db, "2026-10-05");
    tables = Object.fromEntries((await exportTables(db, "2026-10-05")).map((t) => [t.file, t.rows]));
  });

  it("includes voided invoices and splits mixed-use expenses", async () => {
    const invoices = tables["invoices.csv"];
    expect(invoices[0][0]).toBe("Number");
    expect(invoices.slice(1).some((r) => r[4] === "Void" && r[9])).toBe(true);
    const expenses = tables["expenses.csv"];
    for (const r of expenses.slice(1)) {
      expect(Number(r[6]) * 100 + Number(r[7]) * 100).toBeCloseTo(Number(r[4]) * 100, 6);
    }
    expect(expenses.slice(1).some((r) => r[9] === "Sam Rivera")).toBe(true);
  });

  it("numbers invoice lines per invoice", async () => {
    const lines = tables["invoice-lines.csv"].slice(1);
    const first = lines.filter((r) => r[0] === lines[0][0]).map((r) => r[1]);
    expect(first).toEqual(first.map((_, i) => i + 1));
  });

  it("zips one CSV per table plus a README", async () => {
    const files = unzipSync(await exportZip(db, "2026-10-05"));
    expect(Object.keys(files).sort()).toEqual([...Object.keys(tables), "README.txt"].sort());
    // UTF-8 byte-order mark first, so Excel reads accents correctly.
    expect([...files["clients.csv"].subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(strFromU8(files["clients.csv"]).startsWith("Name,Contact")).toBe(true);
  });
});
