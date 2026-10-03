// Payment and "sent" rules. Status itself is never stored: it follows from sent_at and payments
// (see lib/invoice-status.ts).
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { invoiceLineItems, invoices, PAYMENT_METHODS, payments, type PaymentMethod } from "@/db/schema";
import { isValidDate, type DateStr } from "./dates";
import type { FieldErrors } from "./form";
import { formatCents, parseCents } from "./money";

export { PAYMENT_METHOD_LABELS } from "./payment-methods";

export type PaymentInput = {
  receivedOn: DateStr;
  amountCents: number;
  method: PaymentMethod;
  reference: string;
  notes: string;
};

/** Stored sent_at for a calendar date: noon UTC, so the date reads the same in any US time zone. */
export function sentAtFor(date: DateStr): string {
  return `${date}T12:00:00.000Z`;
}

export function parsePaymentForm(
  raw: { receivedOn: string; amount: string; method: string; reference: string; notes: string },
  today: DateStr,
): { ok: true; input: PaymentInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!isValidDate(raw.receivedOn)) errors.receivedOn = "Enter a valid date.";
  else if (raw.receivedOn > today) errors.receivedOn = "Can't be in the future. Record it when the money arrives.";
  const amountCents = parseCents(raw.amount);
  if (amountCents === null || amountCents <= 0) errors.amount = "Enter an amount greater than zero.";
  if (!(PAYMENT_METHODS as readonly string[]).includes(raw.method)) errors.method = "Pick a method.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      receivedOn: raw.receivedOn,
      amountCents: amountCents!,
      method: raw.method as PaymentMethod,
      reference: raw.reference,
      notes: raw.notes,
    },
  };
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

function openBalance(db: Conn, invoiceId: number): number {
  const total = db
    .select({ v: sql<number>`coalesce(sum(${invoiceLineItems.amountCents}), 0)` })
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .get()!.v;
  const paid = db
    .select({ v: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), isNull(payments.voidedAt)))
    .get()!.v;
  return total - paid;
}

export type Result = { ok: true } | { ok: false; errors: FieldErrors };

/**
 * Record money received. Rejects overpayment. A payment on a never-sent invoice marks it sent
 * on the payment date (the client clearly received it).
 */
export function recordPayment(db: Db, invoiceId: number, input: PaymentInput): Result {
  return db.transaction((tx): Result => {
    const inv = tx.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
    if (!inv) return { ok: false, errors: { form: "Invoice not found." } };
    if (inv.voidedAt) return { ok: false, errors: { form: "This invoice is void. Un-void it first." } };
    const balance = openBalance(tx, invoiceId);
    if (balance <= 0) return { ok: false, errors: { amount: "This invoice is already paid in full." } };
    if (input.amountCents > balance)
      return { ok: false, errors: { amount: `That's more than the ${formatCents(balance)} still owed.` } };
    tx.insert(payments).values({ invoiceId, ...input }).run();
    if (!inv.sentAt) tx.update(invoices).set({ sentAt: sentAtFor(input.receivedOn) }).where(eq(invoices.id, invoiceId)).run();
    return { ok: true };
  });
}

/** Payments are never deleted: voiding keeps the record but removes it from every total. */
export function voidPayment(db: Db, paymentId: number, now = new Date()): Result {
  const p = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!p) return { ok: false, errors: { form: "Payment not found." } };
  if (!p.voidedAt) db.update(payments).set({ voidedAt: now.toISOString() }).where(eq(payments.id, paymentId)).run();
  return { ok: true };
}

export function markSent(db: Db, invoiceId: number, date: string, today: DateStr): Result {
  if (!isValidDate(date)) return { ok: false, errors: { sentOn: "Enter a valid date." } };
  if (date > today) return { ok: false, errors: { sentOn: "Can't be in the future." } };
  const inv = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
  if (!inv) return { ok: false, errors: { form: "Invoice not found." } };
  if (inv.voidedAt) return { ok: false, errors: { form: "This invoice is void." } };
  db.update(invoices).set({ sentAt: sentAtFor(date) }).where(eq(invoices.id, invoiceId)).run();
  return { ok: true };
}

/** Back to draft, e.g. marked sent by mistake. Not allowed once money has been recorded. */
export function markUnsent(db: Db, invoiceId: number): Result {
  const active = db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), isNull(payments.voidedAt)))
    .get();
  if (active) return { ok: false, errors: { form: "It has payments recorded. Void them first." } };
  db.update(invoices).set({ sentAt: null }).where(eq(invoices.id, invoiceId)).run();
  return { ok: true };
}
