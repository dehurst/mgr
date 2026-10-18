import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { openDb } from "@/db";
import { seedDemo } from "@/db/seed";
import { backupsToPrune, buildBackupZip, copyAllRows, cronAuthorized, rowCounts } from "./backup";
import { taxReport } from "./reports";

describe("backups", () => {
  it("copies every row into a fresh database, and the copy produces the same reports", async () => {
    const from = await openDb(":memory:");
    await seedDemo(from, "2026-10-05");
    const to = await openDb(":memory:");
    const counts = await copyAllRows(from, to);
    expect(counts).toEqual(await rowCounts(from));
    expect(await rowCounts(to)).toEqual(counts);
    expect(counts.invoices).toBeGreaterThan(0);
    expect(await taxReport(to, 2026)).toEqual(await taxReport(from, 2026));
  });

  it("zips a standalone database that opens with all the data", async () => {
    const db = await openDb(":memory:");
    await seedDemo(db, "2026-10-05");
    const files = unzipSync(await buildBackupZip(db, "2026-10-05", ["receipts/1-a.jpg"]));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["ledger.db", "csv/invoices.csv", "csv/expenses.csv", "stored-files.txt", "README.txt"]));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "restore-")), "ledger.db");
    fs.writeFileSync(file, files["ledger.db"]);
    const restored = await openDb(file);
    expect(await rowCounts(restored)).toEqual(await rowCounts(db));
    expect(await taxReport(restored, 2026)).toEqual(await taxReport(db, 2026));
  });

  it("only runs the cron with the exact secret", () => {
    expect(cronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(cronAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(cronAuthorized("Bearer s3cret", undefined)).toBe(false);
    expect(cronAuthorized(null, "s3cret")).toBe(false);
    expect(cronAuthorized("Bearer ", "")).toBe(false);
  });

  it("keeps the newest 30 daily backups", () => {
    const days = Array.from({ length: 33 }, (_, i) => `backups/ledger-2026-09-${String(i + 1).padStart(2, "0")}.zip`);
    expect(backupsToPrune([...days, "receipts/x.jpg"])).toEqual(days.slice(0, 3));
    expect(backupsToPrune(days.slice(0, 5))).toEqual([]);
  });
});
