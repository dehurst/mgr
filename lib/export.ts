// "Export all data": every table as a CSV, zipped. Meant for your CPA, for a spreadsheet, or for
// leaving the app. Everything is included, voided rows too (with their voided date), so nothing is
// lost; amounts are plain dollars (1234.56) and dates are YYYY-MM-DD.
import { asc, eq } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import type { Db } from "@/db";
import {
  businessSettings,
  clients,
  expenseCategories,
  expenses,
  invoiceLineItems,
  invoices,
  otherIncome,
  payees,
  payments,
} from "@/db/schema";
import { toCsv, type Cell } from "./csv";
import type { DateStr } from "./dates";
import { STATUS_LABELS } from "./invoice-status";
import { listInvoiceSummaries } from "./invoices";
import { centsToInput as $, formatQuantity } from "./money";
import { EXPENSE_METHOD_LABELS, PAYMENT_METHOD_LABELS } from "./payment-methods";
import { splitExpense } from "./reports/data";
import { scheduleCLabel } from "./schedule-c";

export type ExportTable = { file: string; rows: Cell[][] };

const money = (cents: number | null) => (cents === null ? "" : $(cents));

export function exportTables(db: Db, today: DateStr): ExportTable[] {
  const clientName = new Map(db.select({ id: clients.id, name: clients.name }).from(clients).all().map((c) => [c.id, c.name]));
  const payeeName = new Map(db.select({ id: payees.id, name: payees.name }).from(payees).all().map((p) => [p.id, p.name]));
  const invoiceRows = db.select({ id: invoices.id, number: invoices.number, notes: invoices.notes }).from(invoices).all();
  const invoiceNumber = new Map(invoiceRows.map((i) => [i.id, i.number]));
  const invoiceNotes = new Map(invoiceRows.map((i) => [i.id, i.notes]));
  const lineNo = new Map<number, number>();
  const name = (m: Map<number, string>, id: number | null) => (id === null ? "" : (m.get(id) ?? ""));

  const s = db.select().from(businessSettings).where(eq(businessSettings.id, 1)).get();

  return [
    {
      file: "invoices.csv",
      rows: [
        ["Number", "Client", "Issued", "Due", "Status", "Total", "Paid", "Balance", "Sent at", "Voided at", "Notes"],
        ...listInvoiceSummaries(db, today)
          .sort((a, b) => a.issuedOn.localeCompare(b.issuedOn) || a.number.localeCompare(b.number))
          .map((i) => [
            i.number,
            i.clientName,
            i.issuedOn,
            i.dueOn,
            STATUS_LABELS[i.status],
            $(i.totalCents),
            $(i.paidCents),
            $(i.balanceCents),
            i.sentAt,
            i.voidedAt,
            name(invoiceNotes, i.id),
          ]),
      ],
    },
    {
      file: "invoice-lines.csv",
      rows: [
        ["Invoice", "Line", "Description", "Hours", "Rate", "Amount"],
        ...db
          .select()
          .from(invoiceLineItems)
          .orderBy(asc(invoiceLineItems.invoiceId), asc(invoiceLineItems.sortOrder), asc(invoiceLineItems.id))
          .all()
          .map((l) => [
            name(invoiceNumber, l.invoiceId),
            lineNo.set(l.invoiceId, (lineNo.get(l.invoiceId) ?? 0) + 1).get(l.invoiceId),
            l.description,
            formatQuantity(l.quantityMilli),
            $(l.unitPriceCents),
            $(l.amountCents),
          ]),
      ],
    },
    {
      file: "payments-received.csv",
      rows: [
        ["Received", "Invoice", "Client", "Amount", "Method", "Reference", "Notes", "Voided at"],
        ...db
          .select({ p: payments, clientId: invoices.clientId })
          .from(payments)
          .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
          .orderBy(asc(payments.receivedOn), asc(payments.id))
          .all()
          .map(({ p, clientId }) => [
            p.receivedOn,
            name(invoiceNumber, p.invoiceId),
            name(clientName, clientId),
            $(p.amountCents),
            PAYMENT_METHOD_LABELS[p.method],
            p.reference,
            p.notes,
            p.voidedAt,
          ]),
      ],
    },
    {
      file: "other-income.csv",
      rows: [
        ["Received", "Source", "Client", "Amount", "Notes", "Voided at"],
        ...db
          .select()
          .from(otherIncome)
          .orderBy(asc(otherIncome.receivedOn), asc(otherIncome.id))
          .all()
          .map((o) => [o.receivedOn, o.source, name(clientName, o.clientId), $(o.amountCents), o.notes, o.voidedAt]),
      ],
    },
    {
      file: "expenses.csv",
      rows: [
        ["Paid", "Vendor", "Category", "Schedule C", "Amount paid", "Business %", "Business amount", "Personal amount", "Paid with", "Payee (1099)", "Client", "Description", "Receipt file"],
        ...db
          .select({ e: expenses, category: expenseCategories.name, scheduleCLine: expenseCategories.scheduleCLine })
          .from(expenses)
          .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
          .orderBy(asc(expenses.paidOn), asc(expenses.id))
          .all()
          .map(({ e, category, scheduleCLine }) => {
            const split = splitExpense({ amountCents: e.amountCents, businessPct: e.businessPct, scheduleCLine });
            return [
              e.paidOn,
              e.vendor,
              category,
              scheduleCLabel(scheduleCLine),
              $(e.amountCents),
              split.businessCents === 0 ? 0 : e.businessPct,
              $(split.businessCents),
              $(split.personalCents),
              EXPENSE_METHOD_LABELS[e.paymentMethod],
              name(payeeName, e.payeeId),
              name(clientName, e.clientId),
              e.description,
              e.receiptPath,
            ];
          }),
      ],
    },
    {
      file: "expense-categories.csv",
      rows: [
        ["Name", "Schedule C", "Default business %", "Archived at"],
        ...db
          .select()
          .from(expenseCategories)
          .orderBy(asc(expenseCategories.name))
          .all()
          .map((c) => [c.name, scheduleCLabel(c.scheduleCLine), c.businessPct, c.archivedAt]),
      ],
    },
    {
      file: "clients.csv",
      rows: [
        ["Name", "Contact", "Email", "Billing address", "Default rate", "Notes", "Archived at"],
        ...db
          .select()
          .from(clients)
          .orderBy(asc(clients.name))
          .all()
          .map((c) => [c.name, c.contactName, c.email, c.billingAddress, money(c.defaultRateCents), c.notes, c.archivedAt]),
      ],
    },
    {
      file: "payees.csv",
      rows: [
        ["Name", "Business name", "Email", "Address", "Tax classification", "Attorney", "Tax ID (last 4)", "W-9 received", "Notes", "Archived at"],
        ...db
          .select()
          .from(payees)
          .orderBy(asc(payees.name))
          .all()
          .map((p) => [
            p.name,
            p.businessName,
            p.email,
            p.address,
            p.taxClassification,
            p.isAttorney ? "yes" : "",
            p.tinLast4 ? `${p.tinType?.toUpperCase()} ...${p.tinLast4}` : "",
            p.w9ReceivedOn,
            p.notes,
            p.archivedAt,
          ]),
      ],
    },
    {
      file: "business-settings.csv",
      rows: [
        ["Setting", "Value"],
        ["Business name", s?.businessName],
        ["Address", s?.address],
        ["Email", s?.email],
        ["Phone", s?.phone],
        ["EIN", s?.taxId],
        ["Invoice prefix", s?.invoicePrefix],
        ["Next invoice number", s?.nextInvoiceNumber],
        ["Default terms (days)", s?.defaultTermsDays],
        ["Payment instructions", s?.paymentInstructions],
      ],
    },
  ];
}

/** All tables as CSVs in one zip (UTF-8 with BOM so Excel shows accents correctly). */
export function exportZip(db: Db, today: DateStr): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const t of exportTables(db, today)) files[t.file] = strToU8("﻿" + toCsv(t.rows));
  files["README.txt"] = strToU8(
    [
      `Ledger export, ${today}`,
      "",
      "One CSV per kind of record. Amounts are dollars (1234.56); dates are YYYY-MM-DD; times are UTC.",
      "Voided invoices, payments, and income are included with a 'Voided at' date; reports leave them out.",
      "Receipts and your logo are not in this zip: they're in the app's uploads folder.",
      "",
    ].join("\r\n"),
  );
  return zipSync(files, { level: 6 });
}
