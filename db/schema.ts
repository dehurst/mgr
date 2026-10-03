import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Conventions (see CLAUDE.md):
//   *_cents  integer money       *_on  "YYYY-MM-DD" calendar date
//   *_at     ISO-8601 UTC timestamp, null = not happened

const now = () => new Date().toISOString();
const timestamps = {
  createdAt: text("created_at").notNull().$defaultFn(now),
  updatedAt: text("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
};

export const PAYMENT_METHODS = ["venmo", "check", "cash", "ach_zelle", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const EXPENSE_PAYMENT_METHODS = [
  "business_card",
  "personal_card",
  "bank_transfer",
  "cash",
  "check",
  "other",
] as const;
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

/** Single row, id = 1. */
export const businessSettings = sqliteTable(
  "business_settings",
  {
    id: integer("id").primaryKey(),
    businessName: text("business_name").notNull().default(""),
    address: text("address").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    logoPath: text("logo_path"),
    defaultTermsDays: integer("default_terms_days").notNull().default(15),
    invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1001),
    paymentInstructions: text("payment_instructions").notNull().default(""),
    invoiceEmailSubject: text("invoice_email_subject").notNull().default(""),
    invoiceEmailBody: text("invoice_email_body").notNull().default(""),
    reminderEmailSubject: text("reminder_email_subject").notNull().default(""),
    reminderEmailBody: text("reminder_email_body").notNull().default(""),
    updatedAt: text("updated_at").notNull().$defaultFn(now).$onUpdateFn(now),
  },
  (t) => [
    check("settings_singleton", sql`${t.id} = 1`),
    check("settings_terms", sql`${t.defaultTermsDays} >= 0`),
    check("settings_next_number", sql`${t.nextInvoiceNumber} >= 1`),
  ],
);

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactName: text("contact_name").notNull().default(""),
  email: text("email").notNull().default(""),
  billingAddress: text("billing_address").notNull().default(""),
  /** Pre-fills the rate on new invoice lines for this client. */
  defaultRateCents: integer("default_rate_cents"),
  notes: text("notes").notNull().default(""),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export const invoices = sqliteTable(
  "invoices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull().unique(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    issuedOn: text("issued_on").notNull(),
    dueOn: text("due_on").notNull(),
    notes: text("notes").notNull().default(""),
    sentAt: text("sent_at"),
    voidedAt: text("voided_at"),
    voidReason: text("void_reason").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    index("invoices_client_idx").on(t.clientId),
    index("invoices_issued_idx").on(t.issuedOn),
    check("invoices_due_after_issue", sql`${t.dueOn} >= ${t.issuedOn}`),
  ],
);

export const invoiceLineItems = sqliteTable(
  "invoice_line_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantityMilli: integer("quantity_milli").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("line_items_invoice_idx").on(t.invoiceId),
    check("line_items_qty", sql`${t.quantityMilli} >= 0`),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    receivedOn: text("received_on").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull(),
    reference: text("reference").notNull().default(""),
    notes: text("notes").notNull().default(""),
    voidedAt: text("voided_at"),
    ...timestamps,
  },
  (t) => [
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_received_idx").on(t.receivedOn),
    check("payments_positive", sql`${t.amountCents} > 0`),
  ],
);

export const expenseCategories = sqliteTable(
  "expense_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    scheduleCLine: text("schedule_c_line").notNull(),
    /** Default business-use % (1–100) pre-filled on new expenses in this category. */
    businessPct: integer("business_pct").notNull().default(100),
    archivedAt: text("archived_at"),
    ...timestamps,
  },
  (t) => [check("categories_business_pct", sql`${t.businessPct} between 1 and 100`)],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    paidOn: text("paid_on").notNull(),
    vendor: text("vendor").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    paymentMethod: text("payment_method", { enum: EXPENSE_PAYMENT_METHODS }).notNull(),
    description: text("description").notNull().default(""),
    /** Business-use % (1–100). The rest of the amount counts as personal spending. */
    businessPct: integer("business_pct").notNull().default(100),
    receiptPath: text("receipt_path"),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("expenses_paid_idx").on(t.paidOn),
    index("expenses_category_idx").on(t.categoryId),
    check("expenses_positive", sql`${t.amountCents} > 0`),
    check("expenses_business_pct", sql`${t.businessPct} between 1 and 100`),
  ],
);

/** Income not tied to an invoice (also used for pre-app income backfill, optionally per client). */
export const otherIncome = sqliteTable(
  "other_income",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    receivedOn: text("received_on").notNull(),
    source: text("source").notNull(),
    clientId: integer("client_id").references(() => clients.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    notes: text("notes").notNull().default(""),
    voidedAt: text("voided_at"),
    ...timestamps,
  },
  (t) => [
    index("other_income_received_idx").on(t.receivedOn),
    check("other_income_positive", sql`${t.amountCents} > 0`),
  ],
);

export type BusinessSettings = typeof businessSettings.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type OtherIncome = typeof otherIncome.$inferSelect;
