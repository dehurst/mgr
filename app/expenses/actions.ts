"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { expenses } from "@/db/schema";
import { checkCategory, getExpense, parseExpenseForm } from "@/lib/expenses";
import { file, str, type ActionState } from "@/lib/form";
import { formatCents } from "@/lib/money";
import { deleteUpload, RECEIPT_TYPES, saveUpload } from "@/lib/uploads";

export async function saveExpense(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseExpenseForm({
    paidOn: str(fd, "paidOn"),
    vendor: str(fd, "vendor"),
    categoryId: str(fd, "categoryId"),
    amount: str(fd, "amount"),
    paymentMethod: str(fd, "paymentMethod"),
    description: str(fd, "description"),
    clientId: str(fd, "clientId"),
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors, message: "Please fix the highlighted fields." };

  const db = getDb();
  const existing = id ? getExpense(db, id) : undefined;
  if (id && !existing) return { ok: false, message: "Expense not found." };
  const catError = checkCategory(db, parsed.input.categoryId, existing?.categoryId);
  if (catError) return { ok: false, errors: { categoryId: catError } };

  let receiptPath = existing?.receiptPath ?? null;
  const upload = file(fd, "receipt");
  if (upload) {
    const saved = await saveUpload(upload, "receipts", RECEIPT_TYPES);
    if (!saved.ok) return { ok: false, errors: { receipt: `${saved.error} Use a photo (JPG, PNG, HEIC) or PDF.` } };
    receiptPath = saved.relPath;
  } else if (str(fd, "removeReceipt") === "on") {
    receiptPath = null;
  }

  if (existing) {
    db.update(expenses).set({ ...parsed.input, receiptPath }).where(eq(expenses.id, existing.id)).run();
    if (existing.receiptPath && existing.receiptPath !== receiptPath) await deleteUpload(existing.receiptPath);
  } else {
    db.insert(expenses).values({ ...parsed.input, receiptPath }).run();
  }
  revalidatePath("/", "layout");

  if (str(fd, "then") === "another") {
    const q = new URLSearchParams({
      saved: `${parsed.input.vendor} (${formatCents(parsed.input.amountCents)})`,
      date: parsed.input.paidOn,
      method: parsed.input.paymentMethod,
    });
    redirect(`/expenses/new?${q}`);
  }
  redirect("/expenses");
}

export async function deleteExpense(id: number): Promise<string | void> {
  const db = getDb();
  const existing = getExpense(db, id);
  if (!existing) return "Expense not found.";
  db.delete(expenses).where(eq(expenses.id, id)).run();
  await deleteUpload(existing.receiptPath);
  revalidatePath("/", "layout");
  redirect("/expenses");
}
