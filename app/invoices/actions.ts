"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { today } from "@/lib/dates";
import { str, type ActionState } from "@/lib/form";
import {
  createInvoice,
  deleteDraftInvoice,
  duplicateInvoice,
  parseInvoiceForm,
  unvoidInvoice,
  updateInvoice,
  voidInvoice,
} from "@/lib/invoices";

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

export async function deleteDraft(id: number): Promise<string | void> {
  const r = deleteDraftInvoice(getDb(), id);
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
