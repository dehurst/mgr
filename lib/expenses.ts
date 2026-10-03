import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, EXPENSE_PAYMENT_METHODS, expenseCategories, expenses, type ExpensePaymentMethod } from "@/db/schema";
import { isValidDate, type DateRange, type DateStr } from "./dates";
import type { FieldErrors } from "./form";
import { parseCents, sumCents } from "./money";

export { EXPENSE_METHOD_LABELS } from "./payment-methods";

export type ExpenseInput = {
  paidOn: DateStr;
  vendor: string;
  categoryId: number;
  amountCents: number;
  paymentMethod: ExpensePaymentMethod;
  description: string;
  clientId: number | null;
};

export function parseExpenseForm(
  raw: Record<"paidOn" | "vendor" | "categoryId" | "amount" | "paymentMethod" | "description" | "clientId", string>,
): { ok: true; input: ExpenseInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!isValidDate(raw.paidOn)) errors.paidOn = "Enter a valid date.";
  if (!raw.vendor) errors.vendor = "Who did you pay?";
  const categoryId = Number(raw.categoryId);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) errors.categoryId = "Pick a category.";
  const amountCents = parseCents(raw.amount);
  if (amountCents === null || amountCents <= 0) errors.amount = "Enter an amount greater than zero, like 49.99.";
  if (!(EXPENSE_PAYMENT_METHODS as readonly string[]).includes(raw.paymentMethod)) errors.paymentMethod = "Pick how you paid.";
  const clientId = raw.clientId ? Number(raw.clientId) : null;
  if (clientId !== null && (!Number.isSafeInteger(clientId) || clientId <= 0)) errors.clientId = "Pick a client or leave blank.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      paidOn: raw.paidOn,
      vendor: raw.vendor,
      categoryId,
      amountCents: amountCents!,
      paymentMethod: raw.paymentMethod as ExpensePaymentMethod,
      description: raw.description,
      clientId,
    },
  };
}

/** Archived categories can't be picked for new expenses, but an existing expense may keep one. */
export function checkCategory(db: Db, categoryId: number, currentCategoryId?: number): string | null {
  const cat = db.select().from(expenseCategories).where(eq(expenseCategories.id, categoryId)).get();
  if (!cat) return "That category no longer exists.";
  if (cat.archivedAt && cat.id !== currentCategoryId) return "That category is archived. Pick another or restore it in Settings.";
  return null;
}

export type ExpenseFilter = { range: DateRange; categoryId?: number };

export function listExpenses(db: Db, f: ExpenseFilter) {
  const rows = db
    .select({
      id: expenses.id,
      paidOn: expenses.paidOn,
      vendor: expenses.vendor,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      scheduleCLine: expenseCategories.scheduleCLine,
      amountCents: expenses.amountCents,
      paymentMethod: expenses.paymentMethod,
      description: expenses.description,
      receiptPath: expenses.receiptPath,
      clientId: expenses.clientId,
      clientName: clients.name,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .leftJoin(clients, eq(clients.id, expenses.clientId))
    .where(
      and(
        gte(expenses.paidOn, f.range.from),
        lte(expenses.paidOn, f.range.to),
        f.categoryId ? eq(expenses.categoryId, f.categoryId) : undefined,
      ),
    )
    .orderBy(desc(expenses.paidOn), desc(expenses.id))
    .all();
  return { rows, totalCents: sumCents(rows.map((r) => r.amountCents)) };
}

export function getExpense(db: Db, id: number) {
  return db.select().from(expenses).where(eq(expenses.id, id)).get();
}

/** Vendors used before, most recent first, for the form's autocomplete. */
export function recentVendors(db: Db): string[] {
  return db
    .select({ vendor: expenses.vendor, last: sql<string>`max(${expenses.paidOn})` })
    .from(expenses)
    .groupBy(expenses.vendor)
    .orderBy(desc(sql`max(${expenses.paidOn})`))
    .limit(100)
    .all()
    .map((r) => r.vendor);
}

/** Active categories plus (when editing) the expense's current one, even if archived. */
export function categoryOptions(db: Db, includeId?: number) {
  return db
    .select({ id: expenseCategories.id, name: expenseCategories.name, archivedAt: expenseCategories.archivedAt })
    .from(expenseCategories)
    .where(includeId ? or(isNull(expenseCategories.archivedAt), eq(expenseCategories.id, includeId)) : isNull(expenseCategories.archivedAt))
    .orderBy(asc(expenseCategories.name))
    .all();
}
