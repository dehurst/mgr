"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { importContext, saveImport, undoImport, type ImportResult, type ImportRow } from "@/lib/expense-import";
import { isValidDate } from "@/lib/dates";
import { MAX_IMPORT_ROWS, suggestImport, type StatementLine, type Suggestion } from "@/lib/import";
import { deleteUpload } from "@/lib/uploads";

/** Add suggestions (category from past vendors, duplicates, card payments) to parsed statement lines. */
export async function analyzeImport(lines: StatementLine[]): Promise<Suggestion[]> {
  const clean = (Array.isArray(lines) ? lines : [])
    .slice(0, MAX_IMPORT_ROWS)
    .filter((l) => isValidDate(l?.date) && Number.isSafeInteger(l?.amountCents) && typeof l?.description === "string")
    .map((l) => ({ line: Number(l.line) || 0, date: l.date, description: l.description.slice(0, 500), amountCents: l.amountCents }));
  const db = await getDb();
  const { history, existing } = await importContext(db, clean);
  return suggestImport(clean, history, existing);
}

export async function commitImport(fileName: string, paymentMethod: string, rows: ImportRow[]): Promise<ImportResult> {
  const r = await saveImport(await getDb(), String(fileName ?? ""), String(paymentMethod ?? ""), Array.isArray(rows) ? rows : []);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function undoImportAction(importId: number): Promise<string | void> {
  const receipts = await undoImport(await getDb(), importId);
  for (const p of receipts) await deleteUpload(p);
  revalidatePath("/", "layout");
}
