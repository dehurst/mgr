// Builds each report from the database, plus a CSV table for it. Pages and the CSV route both use
// these, so the numbers on screen and in the export always match.
import type { Db } from "@/db";
import type { Cell } from "@/lib/csv";
import { formatDate, priorRange, type DateRange, type DateStr } from "@/lib/dates";
import { listInvoiceSummaries } from "@/lib/invoices";
import { centsToInput } from "@/lib/money";
import { AGING_BUCKETS, AGING_LABELS, computeAging } from "./aging";
import { loadExpenses, loadIncome, loadPayeePayments, splitExpense } from "./data";
import { FORM_1099_STATUS_LABELS, form1099Rows, maskedTin, threshold1099 } from "./form-1099";
import { expenseReport } from "./expenses";
import { incomeByClient } from "./income-by-client";
import { computePnl, type Pnl } from "./pnl";
import { personalSpending } from "./personal";
import { taxSummary } from "./tax";

const $ = centsToInput;

export async function pnlReport(db: Db, range: DateRange, compare: boolean) {
  const current = computePnl(await loadIncome(db, range), await loadExpenses(db, range));
  const priorR = compare ? priorRange(range) : null;
  const prior = priorR ? computePnl(await loadIncome(db, priorR), await loadExpenses(db, priorR)) : null;
  // Union of categories across both periods, ordered by current amount then prior.
  const cats = new Map<number, string>();
  for (const c of current.expensesByCategory) cats.set(c.categoryId, c.name);
  for (const c of prior?.expensesByCategory ?? []) if (!cats.has(c.categoryId)) cats.set(c.categoryId, c.name);
  const amount = (p: Pnl | null, id: number) => p?.expensesByCategory.find((c) => c.categoryId === id)?.cents ?? 0;
  const categories = [...cats].map(([id, name]) => ({ id, name, current: amount(current, id), prior: amount(prior, id) }));
  return { range, current, prior, priorRange: priorR, categories };
}

export function pnlCsv(r: Awaited<ReturnType<typeof pnlReport>>): Cell[][] {
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

export async function expensesReportData(db: Db, range: DateRange) {
  const rows = await loadExpenses(db, range);
  return { range, rows, ...expenseReport(rows) };
}

export function expensesCsv(r: Awaited<ReturnType<typeof expensesReportData>>): Cell[][] {
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

export async function form1099Report(db: Db, year: number) {
  const range = { from: `${year}-01-01`, to: `${year}-12-31` };
  const { rows, payees } = await loadPayeePayments(db, range);
  return { year, range, threshold: threshold1099(year), rows: form1099Rows(payees, rows, year) };
}

export function form1099Csv(r: Awaited<ReturnType<typeof form1099Report>>): Cell[][] {
  return [
    [`1099-NEC summary, tax year ${r.year} (threshold ${$(r.threshold.cents)})`],
    [],
    ["Payee", "Business name", "Tax ID", "Address", "Box 1 nonemployee compensation", "Paid by card / Venmo-PayPal goods & services (not on 1099-NEC)", "Status", "Missing"],
    ...r.rows.map((x) => [
      x.payee.name,
      x.payee.businessName,
      maskedTin(x.payee),
      x.payee.address,
      $(x.reportableCents),
      $(x.networkCents),
      FORM_1099_STATUS_LABELS[x.status],
      x.missing.join(", "),
    ]),
  ];
}

export async function personalReport(db: Db, range: DateRange) {
  const rows = await loadExpenses(db, range);
  return { range, ...personalSpending(rows), businessCents: expenseReport(rows).totalCents };
}

export function personalCsv(r: Awaited<ReturnType<typeof personalReport>>): Cell[][] {
  return [
    [`Personal spending, ${formatDate(r.range.from)} – ${formatDate(r.range.to)}`],
    ["Personal-category purchases plus the personal share of mixed-use expenses. Not business expenses."],
    [],
    ["Date", "Vendor", "Category", "Description", "Amount paid", "Business %", "Personal amount"],
    ...r.items.map((e) => [e.date, e.vendor, e.categoryName, e.description, $(e.amountCents), e.scheduleCLine === "personal" ? 0 : e.businessPct, $(e.personalCents)]),
    ["", "", "", "Total personal spending", "", "", $(r.totalCents)],
    [],
    ["By source", "", "Count", "Amount"],
    ...r.bySource.map((x) => [x.fullyPersonal ? x.name : `${x.name} (personal share)`, "", x.count, $(x.cents)]),
    [],
    ["By vendor", "", "Count", "Amount"],
    ...r.byVendor.map((v) => [v.vendor, "", v.count, $(v.cents)]),
    [],
    ["By month", "", "", "Amount"],
    ...r.byMonth.map((m) => [m.month, "", "", $(m.cents)]),
  ];
}

export async function agingReport(db: Db, asOf: DateStr) {
  return { asOf, ...computeAging(await listInvoiceSummaries(db, asOf), asOf) };
}

export function agingCsv(r: Awaited<ReturnType<typeof agingReport>>): Cell[][] {
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

export async function incomeByClientReport(db: Db, range: DateRange) {
  return { range, ...incomeByClient(await loadIncome(db, range)) };
}

export function incomeByClientCsv(r: Awaited<ReturnType<typeof incomeByClientReport>>): Cell[][] {
  return [
    [`Income by client (cash basis), ${formatDate(r.range.from)} – ${formatDate(r.range.to)}`],
    [],
    ["Client", "Invoice payments", "Other income", "Total"],
    ...r.clients.map((c) => [c.clientName, $(c.invoicePaymentsCents), $(c.otherIncomeCents), $(c.totalCents)]),
    ["Total", "", "", $(r.totalCents)],
  ];
}

export async function taxReport(db: Db, year: number) {
  const range = { from: `${year}-01-01`, to: `${year}-12-31` };
  return { year, range, ...taxSummary(await loadIncome(db, range), await loadExpenses(db, range)) };
}

export function taxCsv(r: Awaited<ReturnType<typeof taxReport>>): Cell[][] {
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
