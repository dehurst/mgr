import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, expenses, invoices, otherIncome, type Client } from "@/db/schema";
import type { DateStr } from "./dates";
import { looksLikeEmail, type FieldErrors } from "./form";
import { listInvoiceSummaries, type InvoiceSummary } from "./invoices";
import { parseCents } from "./money";

export type ClientInput = {
  name: string;
  contactName: string;
  email: string;
  billingAddress: string;
  defaultRateCents: number | null;
  notes: string;
};

export function parseClientForm(raw: Record<keyof ClientInput, string>):
  | { ok: true; input: ClientInput }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!raw.name) errors.name = "Required.";
  if (raw.email && !looksLikeEmail(raw.email)) errors.email = "Doesn't look like an email address.";
  let defaultRateCents: number | null = null;
  if (raw.defaultRateCents) {
    defaultRateCents = parseCents(raw.defaultRateCents);
    if (defaultRateCents === null || defaultRateCents < 0) errors.defaultRateCents = "Enter an amount like 85 or 85.50.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, input: { ...raw, defaultRateCents } };
}

export type ClientTotals = {
  billedCents: number;
  paidCents: number;
  balanceCents: number;
  overdueCents: number;
  draftCount: number;
};

/** Billed = sent, non-void invoices. Drafts and voids are excluded. */
export function totalsFor(summaries: InvoiceSummary[]): ClientTotals {
  const t: ClientTotals = { billedCents: 0, paidCents: 0, balanceCents: 0, overdueCents: 0, draftCount: 0 };
  for (const s of summaries) {
    if (s.status === "void") continue;
    if (s.status === "draft") {
      t.draftCount++;
      continue;
    }
    t.billedCents += s.totalCents;
    t.paidCents += s.paidCents;
    t.balanceCents += s.balanceCents;
    if (s.status === "overdue") t.overdueCents += s.balanceCents;
  }
  return t;
}

export function listClientsWithTotals(db: Db, today: DateStr) {
  const all = db.select().from(clients).orderBy(asc(clients.name)).all();
  const summaries = listInvoiceSummaries(db, today);
  return all.map((c) => ({ ...c, totals: totalsFor(summaries.filter((s) => s.clientId === c.id)) }));
}

/** A client can be deleted only if nothing references it; otherwise archive. */
export function deleteClient(db: Db, id: number): { ok: true } | { ok: false; error: string } {
  const used =
    db.select({ id: invoices.id }).from(invoices).where(eq(invoices.clientId, id)).get() ||
    db.select({ id: expenses.id }).from(expenses).where(eq(expenses.clientId, id)).get() ||
    db.select({ id: otherIncome.id }).from(otherIncome).where(eq(otherIncome.clientId, id)).get();
  if (used) return { ok: false, error: "This client has invoices or linked records. Archive it instead." };
  db.delete(clients).where(eq(clients.id, id)).run();
  return { ok: true };
}

export function getClient(db: Db, id: number): Client | undefined {
  return db.select().from(clients).where(eq(clients.id, id)).get();
}
