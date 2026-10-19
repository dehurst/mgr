import { and, asc, desc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, EXPENSE_PAYMENT_METHODS, expenseCategories, expenses, payees, type ExpensePaymentMethod } from "@/db/schema";
import { isValidDate, type DateRange, type DateStr } from "./dates";
import type { FieldErrors } from "./form";
import type { Cell } from "./csv";
import { centsToInput, parseCents, sumCents } from "./money";
import { EXPENSE_METHOD_LABELS } from "./payment-methods";
import { scheduleCLabel } from "./schedule-c";
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
  raw: Record<"paidOn" | "vendor" | "categoryId" | "amount" | "paymentMethod" | "description" | "clientId" | "payeeId" | "businessPct", string> & {
    /** "on" when "This is a refund" is checked (phone keypads have no minus key). */
    refund?: string;
  },
): { ok: true; input: ExpenseInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!isValidDate(raw.paidOn)) errors.paidOn = "Enter a valid date.";
  if (!raw.vendor) errors.vendor = "Who did you pay?";
  const categoryId = Number(raw.categoryId);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) errors.categoryId = "Pick a category.";
  // A refund is a negative expense: from the checkbox, or typed with a minus sign.
  const parsed = parseCents(raw.amount);
  const amountCents = parsed !== null && raw.refund === "on" ? -Math.abs(parsed) : parsed;
  if (amountCents === null || amountCents === 0) errors.amount = "Enter an amount like 49.99, or -49.99 for a refund.";
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
export async function checkCategory(db: Db, categoryId: number, currentCategoryId?: number): Promise<string | null> {
  const cat = await db.select().from(expenseCategories).where(eq(expenseCategories.id, categoryId)).get();
  if (!cat) return "That category no longer exists.";
  if (cat.archivedAt && cat.id !== currentCategoryId) return "That category is archived. Pick another or restore it in Settings.";
  return null;
}

/** Like checkCategory: archived payees stay on old expenses but can't be picked for new ones. */
export async function checkPayee(db: Db, payeeId: number | null, currentPayeeId?: number | null): Promise<string | null> {
  if (payeeId === null) return null;
  const p = await db.select().from(payees).where(eq(payees.id, payeeId)).get();
  if (!p) return "That payee no longer exists.";
  if (p.archivedAt && p.id !== currentPayeeId) return "That payee is archived. Pick another or restore it.";
  return null;
}

export type ExpenseFilter = { range: DateRange; categoryId?: number; payeeId?: number };

export async function listExpenses(db: Db, f: ExpenseFilter) {
  const rows = await db
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
      payeeName: payees.name,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .leftJoin(clients, eq(clients.id, expenses.clientId))
    .leftJoin(payees, eq(payees.id, expenses.payeeId))
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

/**
 * The Expenses page as a spreadsheet: the same rows (same dates and category filter) with each
 * expense's business/personal split, and the page's business and personal totals at the bottom.
 */
export function expenseListCsv(list: Awaited<ReturnType<typeof listExpenses>>, title: string): Cell[][] {
  const $ = centsToInput;
  return [
    [title],
    [],
    ["Date", "Vendor", "Category", "Schedule C", "Description", "Paid with", "Amount paid", "Business %", "Business amount", "Personal amount", "Payee (1099)", "Client", "Receipt"],
    ...list.rows.map((r) => {
      const split = splitExpense(r);
      return [
        r.paidOn,
        r.vendor,
        r.categoryName,
        scheduleCLabel(r.scheduleCLine),
        r.description,
        EXPENSE_METHOD_LABELS[r.paymentMethod],
        $(r.amountCents),
        split.businessCents === 0 ? 0 : r.businessPct,
        $(split.businessCents),
        $(split.personalCents),
        r.payeeName ?? "",
        r.clientName ?? "",
        r.receiptPath ? "yes" : "",
      ];
    }),
    [],
    ["Business expenses", "", "", "", "", "", "", "", $(list.totalCents)],
    ["Personal (not a business expense)", "", "", "", "", "", "", "", "", $(list.personalCents)],
  ];
}

export async function getExpense(db: Db, id: number) {
  return await db.select().from(expenses).where(eq(expenses.id, id)).get();
}

/** Vendors used before, most recent first, for the form's autocomplete. */
export async function recentVendors(db: Db): Promise<string[]> {
  return (await db
    .select({ vendor: expenses.vendor, last: sql<string>`max(${expenses.paidOn})` })
    .from(expenses)
    .groupBy(expenses.vendor)
    .orderBy(desc(sql`max(${expenses.paidOn})`))
    .limit(100)
    .all())
    .map((r) => r.vendor);
}

/** Active categories plus (when editing) the expense's current one, even if archived. */
export async function categoryOptions(db: Db, includeId?: number) {
  return await db
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
export async function applyBusinessPctToCategory(db: Db, categoryId: number, businessPct: number): Promise<number> {
  const result = await db
    .update(expenses)
    .set({ businessPct })
    .where(and(eq(expenses.categoryId, categoryId), ne(expenses.businessPct, businessPct)))
    .run();
  return result.rowsAffected;
}
