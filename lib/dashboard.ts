import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, expenseCategories, expenses, invoices, otherIncome, payments } from "@/db/schema";
import { presetRange, type DateStr } from "./dates";
import { PERSONAL_LINE } from "./schedule-c";
import { listInvoiceSummaries } from "./invoices";
import { computeAging } from "./reports/aging";
import { loadExpenses, loadIncome } from "./reports/data";
import { computePnl } from "./reports/pnl";

export type Activity = { date: DateStr; kind: "payment" | "income" | "expense" | "sent" | "created"; text: string; cents: number | null; href: string };

/** Latest events across payments, other income, expenses, and invoices. */
export function recentActivity(db: Db, limit = 8): Activity[] {
  const out: Activity[] = [];
  for (const p of db
    .select({ id: invoices.id, date: payments.receivedOn, cents: payments.amountCents, number: invoices.number, client: clients.name })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(isNull(payments.voidedAt))
    .orderBy(desc(payments.receivedOn), desc(payments.id))
    .limit(limit)
    .all())
    out.push({ date: p.date, kind: "payment", text: `Payment from ${p.client} on ${p.number}`, cents: p.cents, href: `/invoices/${p.id}` });

  for (const o of db.select().from(otherIncome).where(isNull(otherIncome.voidedAt)).orderBy(desc(otherIncome.receivedOn)).limit(limit).all())
    out.push({ date: o.receivedOn, kind: "income", text: o.source, cents: o.amountCents, href: `/income/${o.id}` });

  for (const e of db.select().from(expenses).orderBy(desc(expenses.paidOn), desc(expenses.id)).limit(limit).all())
    out.push({ date: e.paidOn, kind: "expense", text: e.vendor, cents: e.amountCents, href: `/expenses/${e.id}` });

  for (const i of db
    .select({ id: invoices.id, number: invoices.number, sentAt: invoices.sentAt, client: clients.name })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(isNotNull(invoices.sentAt), isNull(invoices.voidedAt)))
    .orderBy(desc(invoices.sentAt))
    .limit(limit)
    .all())
    out.push({ date: i.sentAt!.slice(0, 10), kind: "sent", text: `Sent ${i.number} to ${i.client}`, cents: null, href: `/invoices/${i.id}` });

  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
}

export function dashboardData(db: Db, today: DateStr) {
  const ytd = presetRange("ytd", today);
  const month = presetRange("this_month", today);
  const ytdPnl = computePnl(loadIncome(db, ytd), loadExpenses(db, ytd));
  const monthPnl = computePnl(loadIncome(db, month), loadExpenses(db, month));
  const summaries = listInvoiceSummaries(db, today);
  const aging = computeAging(summaries, today);
  const overdue = summaries
    .filter((s) => s.status === "overdue")
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1))
    .slice(0, 5);
  const drafts = summaries.filter((s) => s.status === "draft").length;
  const personalCategoryId =
    db.select({ id: expenseCategories.id }).from(expenseCategories).where(eq(expenseCategories.scheduleCLine, PERSONAL_LINE)).get()?.id ?? null;
  return { ytd, month, ytdPnl, monthPnl, aging, overdue, drafts, activity: recentActivity(db), personalCategoryId };
}
