// Backups: a complete copy of the books as a standalone SQLite file (opens in the app, any SQLite
// tool, or imports into Turso) plus every table as CSV, zipped. Built the same way for the daily
// cloud backup, the "Download backup" button, and the one-time move to the cloud.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { connect, prepareDb, type Db } from "@/db";
import * as schema from "@/db/schema";
import { toCsv } from "./csv";
import type { DateStr } from "./dates";
import { exportTables } from "./export";

/** Parents before children, so foreign keys hold while copying. */
export const TABLES_IN_ORDER = [
  schema.businessSettings,
  schema.expenseCategories,
  schema.clients,
  schema.payees,
  schema.invoices,
  schema.invoiceLineItems,
  schema.payments,
  schema.expenseImports,
  schema.expenses,
  schema.otherIncome,
] as const;

type Table = (typeof TABLES_IN_ORDER)[number];

/**
 * Copy every row (ids included) from one database into another that has only the default rows a
 * fresh install creates. Those defaults are replaced. Returns the row count per table.
 */
export async function copyAllRows(from: Db, to: Db): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await to.transaction(async (tx) => {
    for (const t of [...TABLES_IN_ORDER].reverse()) await tx.delete(t).run();
    for (const t of TABLES_IN_ORDER) {
      const rows = (await from.select().from(t as Table).all()) as (typeof t.$inferInsert)[];
      for (let i = 0; i < rows.length; i += 100) {
        await tx.insert(t as Table).values(rows.slice(i, i + 100) as never).run();
      }
      counts[tableName(t)] = rows.length;
    }
  });
  return counts;
}

export async function rowCounts(db: Db): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const t of TABLES_IN_ORDER) counts[tableName(t)] = (await db.select().from(t as Table).all()).length;
  return counts;
}

const tableName = (t: Table) => getTableName(t);

/** The whole database as one standalone SQLite file. */
export async function snapshotDatabase(db: Db): Promise<Uint8Array> {
  const file = path.join(os.tmpdir(), `ledger-snapshot-${crypto.randomBytes(6).toString("hex")}.db`);
  // No WAL here, so everything lands in the one file.
  const copy = connect(`file:${file}`);
  try {
    await prepareDb(copy);
    await copyAllRows(db, copy);
  } finally {
    copy.$client.close();
  }
  try {
    return new Uint8Array(await fs.readFile(/*turbopackIgnore: true*/ file));
  } finally {
    for (const f of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) await fs.rm(/*turbopackIgnore: true*/ f, { force: true });
  }
}

export async function buildBackupZip(db: Db, today: DateStr, receiptPaths: string[]): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = { "ledger.db": await snapshotDatabase(db) };
  for (const t of await exportTables(db, today)) files[`csv/${t.file}`] = strToU8("﻿" + toCsv(t.rows));
  files["stored-files.txt"] = strToU8(receiptPaths.join("\n") + "\n");
  files["README.txt"] = strToU8(
    [
      `Simple Ledger backup, ${today}`,
      "",
      "ledger.db  - the complete books as a SQLite database. To use it on the Mac, put it at",
      "             data/ledger.db. To restore the cloud database: turso db create <name> --from-file ledger.db",
      "csv/       - every table as a spreadsheet (amounts in dollars, dates YYYY-MM-DD).",
      "stored-files.txt - receipts and logo kept in file storage (not inside this zip).",
      "",
    ].join("\r\n"),
  );
  return zipSync(files, { level: 6 });
}

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". No secret configured means no access. */
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

/** Which dated backups to delete, keeping the newest `keep`. */
export function backupsToPrune(paths: string[], keep = 30): string[] {
  const backups = paths.filter((p) => /^backups\/ledger-\d{4}-\d{2}-\d{2}\.zip$/.test(p)).sort();
  return backups.slice(0, Math.max(0, backups.length - keep));
}
