// Statement imports, server side: what suggestions need from the database, saving an import as
// one transaction, and undoing it. Parsing and suggestions themselves are pure (lib/import.ts).
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { EXPENSE_PAYMENT_METHODS, expenseCategories, expenseImports, expenses, type ExpensePaymentMethod } from "@/db/schema";
import { addDays, isValidDate, type DateStr } from "./dates";
import { MAX_IMPORT_ROWS, type ExistingExpense, type HistoryVendor, type StatementLine } from "./import";

/** Each past vendor's most recent category and business %, plus expenses near the file's dates. */
export async function importContext(db: Db, lines: StatementLine[]): Promise<{ history: HistoryVendor[]; existing: ExistingExpense[] }> {
  const past = await db
    .select({ vendor: expenses.vendor, categoryId: expenses.categoryId, businessPct: expenses.businessPct })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(isNull(expenseCategories.archivedAt))
    .orderBy(desc(expenses.paidOn), desc(expenses.id))
    .all();
  const seen = new Set<string>();
  const history = past.filter((p) => {
    const key = p.vendor.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!lines.length) return { history, existing: [] };
  const dates = lines.map((l) => l.date).sort();
  const existing = await db
    .select({ paidOn: expenses.paidOn, amountCents: expenses.amountCents, vendor: expenses.vendor })
    .from(expenses)
    .where(and(gte(expenses.paidOn, addDays(dates[0], -3)), lte(expenses.paidOn, addDays(dates[dates.length - 1], 3))))
    .all();
  return { history, existing };
}

export type ImportRow = {
  date: string;
  vendor: string;
  description: string;
  amountCents: number;
  categoryId: number;
  businessPct: number;
};

export type ImportResult = { ok: true; importId: number; count: number } | { ok: false; error: string };

/** Validate every row, then save them all (or nothing) under one import. */
export async function saveImport(db: Db, fileName: string, paymentMethod: string, rows: ImportRow[]): Promise<ImportResult> {
  if (!rows.length) return { ok: false, error: "Nothing is checked to import." };
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: `Up to ${MAX_IMPORT_ROWS} rows per import; split the file.` };
  if (!(EXPENSE_PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) return { ok: false, error: "Pick what these were paid with." };
  const active = new Set(
    (await db.select({ id: expenseCategories.id }).from(expenseCategories).where(isNull(expenseCategories.archivedAt)).all()).map((c) => c.id),
  );
  for (const [i, r] of rows.entries()) {
    const where = `Row ${i + 1}${r.vendor ? ` (${r.vendor})` : ""}`;
    if (!isValidDate(r.date)) return { ok: false, error: `${where}: bad date.` };
    if (typeof r.vendor !== "string" || !r.vendor.trim() || r.vendor.length > 120) return { ok: false, error: `${where}: vendor is required.` };
    if (!Number.isSafeInteger(r.amountCents) || r.amountCents === 0) return { ok: false, error: `${where}: bad amount.` };
    if (!active.has(r.categoryId)) return { ok: false, error: `${where}: pick a category.` };
    if (!Number.isInteger(r.businessPct) || r.businessPct < 1 || r.businessPct > 100) return { ok: false, error: `${where}: business % must be 1–100.` };
  }
  return db.transaction(async (tx) => {
    const imp = await tx.insert(expenseImports).values({ fileName: fileName.slice(0, 200) }).returning({ id: expenseImports.id }).get();
    for (let i = 0; i < rows.length; i += 100) {
      await tx
        .insert(expenses)
        .values(
          rows.slice(i, i + 100).map((r) => ({
            paidOn: r.date as DateStr,
            vendor: r.vendor.trim(),
            description: String(r.description ?? "").slice(0, 500),
            amountCents: r.amountCents,
            categoryId: r.categoryId,
            businessPct: r.businessPct,
            paymentMethod: paymentMethod as ExpensePaymentMethod,
            importId: imp.id,
          })),
        )
        .run();
    }
    return { ok: true as const, importId: imp.id, count: rows.length };
  });
}

/** Past imports, newest first, with how many expenses each still has and their total. */
export async function listImports(db: Db) {
  return db
    .select({
      id: expenseImports.id,
      fileName: expenseImports.fileName,
      createdAt: expenseImports.createdAt,
      count: sql<number>`count(${expenses.id})`,
      totalCents: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
      from: sql<string | null>`min(${expenses.paidOn})`,
      to: sql<string | null>`max(${expenses.paidOn})`,
    })
    .from(expenseImports)
    .leftJoin(expenses, eq(expenses.importId, expenseImports.id))
    .groupBy(expenseImports.id)
    .orderBy(desc(expenseImports.id))
    .all();
}

/** Delete every expense from one import (even ones edited since) and the import itself. Returns their receipts. */
export async function undoImport(db: Db, importId: number): Promise<string[]> {
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: expenses.id, receiptPath: expenses.receiptPath }).from(expenses).where(eq(expenses.importId, importId)).all();
    if (rows.length) await tx.delete(expenses).where(inArray(expenses.id, rows.map((r) => r.id))).run();
    await tx.delete(expenseImports).where(eq(expenseImports.id, importId)).run();
    return rows.map((r) => r.receiptPath).filter((p): p is string => !!p);
  });
}
