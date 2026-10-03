// Builds each report from the database, plus a CSV table for it. Pages and the CSV route both use
// these, so the numbers on screen and in the export always match.
import type { Db } from "@/db";
import type { Cell } from "@/lib/csv";
import { formatDate, priorRange, type DateRange, type DateStr } from "@/lib/dates";
import { listInvoiceSummaries } from "@/lib/invoices";
import { centsToInput } from "@/lib/money";
import { AGING_BUCKETS, AGING_LABELS, computeAging } from "./aging";
import { loadExpenses, loadIncome, splitExpense } from "./data";
import { expenseReport } from "./expenses";
import { incomeByClient } from "./income-by-client";
import { computePnl, type Pnl } from "./pnl";
import { taxSummary } from "./tax";

const $ = centsToInput;

export function pnlReport(db: Db, range: DateRange, compare: boolean) {
  const current = computePnl(loadIncome(db, range), loadExpenses(db, range));
  const priorR = compare ? priorRange(range) : null;
  const prior = priorR ? computePnl(loadIncome(db, priorR), loadExpenses(db, priorR)) : null;
  // Union of categories across both periods, ordered by current amount then prior.
  const cats = new Map<number, string>();
  for (const c of current.expensesByCategory) cats.set(c.categoryId, c.name);
  for (const c of prior?.expensesByCategory ?? []) if (!cats.has(c.categoryId)) cats.set(c.categoryId, c.name);
  const amount = (p: Pnl | null, id: number) => p?.expensesByCategory.find((c) => c.categoryId === id)?.cents ?? 0;
  const categories = [...cats].map(([id, name]) => ({ id, name, current: amount(current, id), prior: amount(prior, id) }));
  return { range, current, prior, priorRange: priorR, categories };
}

export function pnlCsv(r: ReturnType<typeof pnlReport>): Cell[][] {
  const head = r.prior ? ["", "Current", "Prior", "Change"] : ["", "Amount"];
  const row = (label: string, cur: number, pri?: number): Cell[] =>
    r.prior ? [label, $(cur), $(pri ?? 0), $(cur - (pri ?? 0))] : [label, $(cur)];
  return [
    [`Profit & Loss (cash basis), ${formatDate(r.range.from)} – ${formatDate(r.range.to)}`],
    ...(r.priorRange ? [[`Compared with ${formatDate(r.priorRange.from)} – ${formatDate(r.priorRange.to)}`]] : []),
    [],
    head,
    ["Income"],
    row("Invoice payments", r.current.invoicePaymentsCents, r.prior?.invoicePaymentsCents),
    row("Other income", r.current.otherIncomeCents, r.prior?.otherIncomeCents),
    row("Total income", r.current.incomeCents, r.prior?.incomeCents),
    ["Expenses"],
    ...r.categories.map((c) => row(c.name, c.current, c.prior)),
    row("Total expenses", r.current.expensesCents, r.prior?.expensesCents),
    [],
    row("Net profit", r.current.netCents, r.prior?.netCents),
    ...(r.current.personalCents || r.prior?.personalCents
      ? [[], row("Personal spending (not included above)", r.current.personalCents, r.prior?.personalCents)]
      : []),
  ];
}

export function expensesReportData(db: Db, range: DateRange) {
  const rows = loadExpenses(db, range);
  return { range, rows, ...expenseReport(rows) };
}

export function expensesCsv(r: ReturnType<typeof expensesReportData>): Cell[][] {
  return [
    [`Expense report, ${formatDate(r.range.from)} – ${formatDate(r.range.to)}`],
    [],
    ["Date", "Vendor", "Category", "Schedule C line", "Description", "Amount paid", "Business %", "Business amount"],
    ...r.business.map((e) => [e.date, e.vendor, e.categoryName, e.scheduleCLine, e.description, $(e.amountCents), e.businessPct, $(splitExpense(e).businessCents)]),
    ["", "", "", "", "Total business expenses", "", "", $(r.totalCents)],
    ...(r.personal.length
      ? [
          [],
          ["Personal (not business, excluded from totals)"],
          ...r.personal.map((e) => [e.date, e.vendor, e.categoryName, "", e.description, $(e.amountCents)]),
          ["", "", "", "", "Total personal (incl. personal share of mixed-use expenses)", $(r.personalCents)],
        ]
      : []),
    [],
    ["By category", "", "Count", "Amount"],
    ...r.byCategory.map((c) => [c.name, "", c.count, $(c.cents)]),
    [],
    ["By vendor", "", "Count", "Amount"],
    ...r.byVendor.map((v) => [v.vendor, "", v.count, $(v.cents)]),
  ];
}

export function agingReport(db: Db, asOf: DateStr) {
  return { asOf, ...computeAging(listInvoiceSummaries(db, asOf), asOf) };
}

export function agingCsv(r: ReturnType<typeof agingReport>): Cell[][] {
  return [
    [`Accounts receivable aging as of ${formatDate(r.asOf)}`],
    [],
    ["Invoice", "Client", "Issued", "Due", "Days past due", "Bucket", "Balance"],
    ...r.rows.map((x) => [x.number, x.clientName, x.issuedOn, x.dueOn, x.daysPastDue, AGING_LABELS[x.bucket], $(x.balanceCents)]),
    [],
    ...AGING_BUCKETS.map((b) => [AGING_LABELS[b], "", "", "", "", "", $(r.buckets[b])]),
    ["Total", "", "", "", "", "", $(r.totalCents)],
  ];
}

export function incomeByClientReport(db: Db, range: DateRange) {
  return { range, ...incomeByClient(loadIncome(db, range)) };
}

export function incomeByClientCsv(r: ReturnType<typeof incomeByClientReport>): Cell[][] {
  return [
    [`Income by client (cash basis), ${formatDate(r.range.from)} – ${formatDate(r.range.to)}`],
    [],
    ["Client", "Invoice payments", "Other income", "Total"],
    ...r.clients.map((c) => [c.clientName, $(c.invoicePaymentsCents), $(c.otherIncomeCents), $(c.totalCents)]),
    ["Total", "", "", $(r.totalCents)],
  ];
}

export function taxReport(db: Db, year: number) {
  const range = { from: `${year}-01-01`, to: `${year}-12-31` };
  return { year, range, ...taxSummary(loadIncome(db, range), loadExpenses(db, range)) };
}

export function taxCsv(r: ReturnType<typeof taxReport>): Cell[][] {
  return [
    [`Schedule C summary (cash basis), tax year ${r.year}`],
    [],
    ["Line", "Description", "Category", "Amount"],
    ["1", "Gross receipts", "", $(r.grossReceiptsCents)],
    ...r.lines.flatMap((l) => [
      [l.line, l.label, "", $(l.cents)] as Cell[],
      ...l.categories.map((c) => ["", "", l.line === "24b" ? `${c.name} (spent; 50% counted above)` : c.name, $(c.cents)] as Cell[]),
    ]),
    ["28", "Total expenses", "", $(r.totalExpensesCents)],
    ["", "Net (before any adjustments)", "", $(r.netCents)],
    [],
    ...(r.mealsCents ? [["24b", `Meals: ${$(r.mealsCents)} spent, 50% deductible = ${$(r.mealsDeductibleCents)} (used above)`]] : []),
    ["Note: meals are limited to 50% on line 24b. Other amounts are as recorded; your CPA handles depreciation and home office."],
  ];
}
