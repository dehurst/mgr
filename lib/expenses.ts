import { and, asc, desc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, EXPENSE_PAYMENT_METHODS, expenseCategories, expenses, payees, type ExpensePaymentMethod } from "@/db/schema";
import { isValidDate, type DateRange, type DateStr } from "./dates";
import type { FieldErrors } from "./form";
import { parseCents, sumCents } from "./money";
import { splitExpense } from "./reports/data";

export { EXPENSE_METHOD_LABELS } from "./payment-methods";

export type ExpenseInput = {
  paidOn: DateStr;
  vendor: string;
  categoryId: number;
  amountCents: number;
  paymentMethod: ExpensePaymentMethod;
  description: string;
  clientId: number | null;
  payeeId: number | null;
  businessPct: number;
};

export function parseExpenseForm(
  raw: Record<"paidOn" | "vendor" | "categoryId" | "amount" | "paymentMethod" | "description" | "clientId" | "payeeId" | "businessPct", string>,
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
  const payeeId = raw.payeeId ? Number(raw.payeeId) : null;
  if (payeeId !== null && (!Number.isSafeInteger(payeeId) || payeeId <= 0)) errors.payeeId = "Pick a payee or leave blank.";
  const businessPct = parseBusinessPct(raw.businessPct);
  if (businessPct === null) errors.businessPct = "Enter a whole number from 1 to 100.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      businessPct: businessPct!,
      paidOn: raw.paidOn,
      vendor: raw.vendor,
      categoryId,
      amountCents: amountCents!,
      paymentMethod: raw.paymentMethod as ExpensePaymentMethod,
      description: raw.description,
      clientId,
      payeeId,
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

/** Like checkCategory: archived payees stay on old expenses but can't be picked for new ones. */
export function checkPayee(db: Db, payeeId: number | null, currentPayeeId?: number | null): string | null {
  if (payeeId === null) return null;
  const p = db.select().from(payees).where(eq(payees.id, payeeId)).get();
  if (!p) return "That payee no longer exists.";
  if (p.archivedAt && p.id !== currentPayeeId) return "That payee is archived. Pick another or restore it.";
  return null;
}

export type ExpenseFilter = { range: DateRange; categoryId?: number; payeeId?: number };

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
      businessPct: expenses.businessPct,
      receiptPath: expenses.receiptPath,
      clientId: expenses.clientId,
      clientName: clients.name,
      payeeId: expenses.payeeId,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .leftJoin(clients, eq(clients.id, expenses.clientId))
    .where(
      and(
        gte(expenses.paidOn, f.range.from),
        lte(expenses.paidOn, f.range.to),
        f.categoryId ? eq(expenses.categoryId, f.categoryId) : undefined,
        f.payeeId ? eq(expenses.payeeId, f.payeeId) : undefined,
      ),
    )
    .orderBy(desc(expenses.paidOn), desc(expenses.id))
    .all();
  const parts = rows.map((r) => splitExpense(r));
  return {
    rows,
    /** Business share of the rows; personal spending (incl. personal shares) is shown separately. */
    totalCents: sumCents(parts.map((p) => p.businessCents)),
    personalCents: sumCents(parts.map((p) => p.personalCents)),
  };
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
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      archivedAt: expenseCategories.archivedAt,
      businessPct: expenseCategories.businessPct,
      scheduleCLine: expenseCategories.scheduleCLine,
    })
    .from(expenseCategories)
    .where(includeId ? or(isNull(expenseCategories.archivedAt), eq(expenseCategories.id, includeId)) : isNull(expenseCategories.archivedAt))
    .orderBy(asc(expenseCategories.name))
    .all();
}

/** Parse a business-use percent from a form: whole number 1–100. Blank means 100. */
export function parseBusinessPct(raw: string): number | null {
  const s = raw.trim().replace(/%$/, "");
  if (s === "") return 100;
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 100 ? n : null;
}

/** Set every expense in a category to the given business-use percent. Returns how many changed. */
export function applyBusinessPctToCategory(db: Db, categoryId: number, businessPct: number): number {
  return db
    .update(expenses)
    .set({ businessPct })
    .where(and(eq(expenses.categoryId, categoryId), ne(expenses.businessPct, businessPct)))
    .run().changes;
}
