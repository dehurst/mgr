"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { today } from "@/lib/dates";
import { str, type ActionState } from "@/lib/form";
import {
  createInvoice,
  deleteInvoice,
  getInvoiceDetail,
  duplicateInvoice,
  parseInvoiceForm,
  unvoidInvoice,
  updateInvoice,
  voidInvoice,
} from "@/lib/invoices";
import { markSent, markUnsent, parsePaymentForm, recordPayment, voidPayment } from "@/lib/payments";

export async function saveInvoice(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseInvoiceForm({
    clientId: str(fd, "clientId"),
    number: str(fd, "number"),
    issuedOn: str(fd, "issuedOn"),
    dueOn: str(fd, "dueOn"),
    notes: str(fd, "notes"),
    linesJson: str(fd, "lines"),
  });
  if (!parsed.ok) return { ok: false, errors: parsed.errors, message: "Please fix the highlighted fields." };

  const db = getDb();
  const result = id ? updateInvoice(db, id, parsed.input) : createInvoice(db, parsed.input);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.errors.form ?? "Please fix the highlighted fields." };
  revalidatePath("/", "layout");
  redirect(`/invoices/${result.id}`);
}

export async function duplicate(id: number): Promise<string | void> {
  const r = duplicateInvoice(getDb(), id, today());
  if (!r.ok) return Object.values(r.errors)[0];
  revalidatePath("/", "layout");
  redirect(`/invoices/${r.id}/edit`);
}

/** Drafts delete after a confirm(); anything else requires typing the invoice number. */
export async function deletePermanently(id: number, typed?: string): Promise<string | void> {
  const db = getDb();
  const d = getInvoiceDetail(db, id);
  if (!d) return "Invoice not found.";
  if (d.invoice.sentAt && typed?.trim() !== d.invoice.number) return "The number didn't match, so nothing was deleted.";
  const r = deleteInvoice(db, id);
  if (!r.ok) return r.error;
  revalidatePath("/", "layout");
  redirect("/invoices");
}

export async function voidIt(id: number, reason?: string): Promise<string | void> {
  const r = voidInvoice(getDb(), id, (reason ?? "").trim());
  if (!r.ok) return r.error;
  revalidatePath("/", "layout");
}

export async function unvoid(id: number): Promise<string | void> {
  unvoidInvoice(getDb(), id);
  revalidatePath("/", "layout");
}

function firstError(errors: Record<string, string>): string {
  return errors.form ?? Object.values(errors)[0] ?? "Something went wrong.";
}

export async function markSentAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = markSent(getDb(), id, str(fd, "sentOn"), today());
  if (!r.ok) return { ok: false, errors: r.errors, message: firstError(r.errors) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markUnsentAction(id: number): Promise<string | void> {
  const r = markUnsent(getDb(), id);
  if (!r.ok) return firstError(r.errors);
  revalidatePath("/", "layout");
}

export async function recordPaymentAction(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parsePaymentForm(
    {
      receivedOn: str(fd, "receivedOn"),
      amount: str(fd, "amount"),
      method: str(fd, "method"),
      reference: str(fd, "reference"),
      notes: str(fd, "notes"),
    },
    today(),
  );
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const r = recordPayment(getDb(), id, parsed.input);
  if (!r.ok) return { ok: false, errors: r.errors, message: r.errors.form };
  revalidatePath("/", "layout");
  return { ok: true, message: "Payment recorded." };
}

export async function voidPaymentAction(paymentId: number): Promise<string | void> {
  const r = voidPayment(getDb(), paymentId);
  if (!r.ok) return firstError(r.errors);
  revalidatePath("/", "layout");
}
