// Loads plain rows for reports. All report math lives in the pure functions next to this file;
// this is the only place reports touch the database.
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, expenseCategories, expenses, invoices, otherIncome, payments } from "@/db/schema";
import type { DateRange, DateStr } from "@/lib/dates";

/** Money received (cash basis): a payment on an invoice, or other income. */
export type IncomeRow = {
  kind: "payment" | "other";
  id: number;
  date: DateStr;
  amountCents: number;
  clientId: number | null;
  clientName: string | null;
  /** Invoice number for payments, source for other income. */
  label: string;
};

export type ExpenseRow = {
  id: number;
  date: DateStr;
  amountCents: number;
  vendor: string;
  categoryId: number;
  categoryName: string;
  scheduleCLine: string;
  description: string;
};

/** Non-voided payments on non-voided invoices, plus non-voided other income, within the range. */
export function loadIncome(db: Db, range: DateRange): IncomeRow[] {
  const pays = db
    .select({
      id: payments.id,
      date: payments.receivedOn,
      amountCents: payments.amountCents,
      clientId: invoices.clientId,
      clientName: clients.name,
      label: invoices.number,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        isNull(payments.voidedAt),
        isNull(invoices.voidedAt),
        gte(payments.receivedOn, range.from),
        lte(payments.receivedOn, range.to),
      ),
    )
    .all()
    .map((r) => ({ ...r, kind: "payment" as const }));

  const other = db
    .select({
      id: otherIncome.id,
      date: otherIncome.receivedOn,
      amountCents: otherIncome.amountCents,
      clientId: otherIncome.clientId,
      clientName: clients.name,
      label: otherIncome.source,
    })
    .from(otherIncome)
    .leftJoin(clients, eq(clients.id, otherIncome.clientId))
    .where(and(isNull(otherIncome.voidedAt), gte(otherIncome.receivedOn, range.from), lte(otherIncome.receivedOn, range.to)))
    .all()
    .map((r) => ({ ...r, kind: "other" as const }));

  return [...pays, ...other].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
}

export function loadExpenses(db: Db, range: DateRange): ExpenseRow[] {
  return db
    .select({
      id: expenses.id,
      date: expenses.paidOn,
      amountCents: expenses.amountCents,
      vendor: expenses.vendor,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      scheduleCLine: expenseCategories.scheduleCLine,
      description: expenses.description,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(and(gte(expenses.paidOn, range.from), lte(expenses.paidOn, range.to)))
    .orderBy(expenses.paidOn, expenses.id)
    .all();
}
