// Invoice persistence and rules. Functions take the db so they can be tested against an
// in-memory database; server actions pass getDb().
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { businessSettings, clients, invoiceLineItems, invoices, payments } from "@/db/schema";
import { addDays, daysBetween, isValidDate, type DateStr } from "./dates";
import type { FieldErrors } from "./form";
import { balanceCents, deriveStatus, type InvoiceStatus } from "./invoice-status";
import { lineAmountCents, parseCents, parseQuantityMilli } from "./money";

export type LineDraft = { description: string; hours: string; rate: string };
export type ParsedLine = { description: string; quantityMilli: number; unitPriceCents: number };
export type InvoiceInput = {
  clientId: number;
  number: string;
  issuedOn: DateStr;
  dueOn: DateStr;
  notes: string;
  lines: ParsedLine[];
};

export const MAX_LINES = 100;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

/** Validate raw form values. Blank rows (no description, hours, or rate) are ignored. */
export function parseInvoiceForm(raw: {
  clientId: string;
  number: string;
  issuedOn: string;
  dueOn: string;
  notes: string;
  linesJson: string;
}): { ok: true; input: InvoiceInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const clientId = Number(raw.clientId);
  if (!Number.isSafeInteger(clientId) || clientId <= 0) errors.clientId = "Pick a client.";
  if (!/^[A-Za-z0-9_\-/.#]{1,30}$/.test(raw.number)) errors.number = "Use 1–30 letters, digits, or - _ / . #";
  if (!isValidDate(raw.issuedOn)) errors.issuedOn = "Enter a valid date.";
  if (!isValidDate(raw.dueOn)) errors.dueOn = "Enter a valid date.";
  else if (isValidDate(raw.issuedOn) && raw.dueOn < raw.issuedOn) errors.dueOn = "Due date can't be before the issue date.";

  let drafts: LineDraft[] = [];
  try {
    const parsed: unknown = JSON.parse(raw.linesJson || "[]");
    if (Array.isArray(parsed)) drafts = parsed as LineDraft[];
  } catch {
    errors.lines = "Line items couldn't be read. Reload and try again.";
  }

  const lines: ParsedLine[] = [];
  drafts.forEach((d, i) => {
    const description = String(d?.description ?? "").trim();
    const hoursRaw = String(d?.hours ?? "").trim();
    const rateRaw = String(d?.rate ?? "").trim();
    if (!description && !hoursRaw && !rateRaw) return;
    const quantityMilli = parseQuantityMilli(hoursRaw);
    const unitPriceCents = parseCents(rateRaw);
    const row = `Line ${i + 1}`;
    if (!description) errors.lines ??= `${row}: add a description.`;
    else if (quantityMilli === null) errors.lines ??= `${row}: hours must be a number like 1.5 (up to 3 decimals).`;
    else if (unitPriceCents === null || unitPriceCents < 0) errors.lines ??= `${row}: rate must be an amount like 85 or 85.50.`;
    else lines.push({ description, quantityMilli, unitPriceCents });
  });
  if (!errors.lines && lines.length === 0) errors.lines = "Add at least one line item.";
  if (lines.length > MAX_LINES) errors.lines = `Up to ${MAX_LINES} lines.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: { clientId, number: raw.number, issuedOn: raw.issuedOn, dueOn: raw.dueOn, notes: raw.notes, lines },
  };
}

async function getSettingsRow(db: Conn) {
  return (await db.select().from(businessSettings).where(eq(businessSettings.id, 1)).get())!;
}

async function numberExists(db: Conn, number: string, exceptId?: number): Promise<boolean> {
  const row = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.number, number)).get();
  return !!row && row.id !== exceptId;
}

/** Next unused number from settings, skipping any already taken (e.g. entered by hand). */
export async function suggestInvoiceNumber(db: Db): Promise<string> {
  const s = await getSettingsRow(db);
  let n = s.nextInvoiceNumber;
  while (await numberExists(db, `${s.invoicePrefix}${n}`)) n++;
  return `${s.invoicePrefix}${n}`;
}

/** If `number` is prefix + an integer at or past the counter, move the counter past it. */
async function advanceCounter(db: Conn, number: string): Promise<void> {
  const s = await getSettingsRow(db);
  if (!number.startsWith(s.invoicePrefix)) return;
  const rest = number.slice(s.invoicePrefix.length);
  if (!/^\d+$/.test(rest)) return;
  const n = Number(rest);
  if (n >= s.nextInvoiceNumber) {
    await db.update(businessSettings).set({ nextInvoiceNumber: n + 1 }).where(eq(businessSettings.id, 1)).run();
  }
}

function lineRows(invoiceId: number, lines: ParsedLine[]) {
  return lines.map((l, i) => ({
    invoiceId,
    description: l.description,
    quantityMilli: l.quantityMilli,
    unitPriceCents: l.unitPriceCents,
    amountCents: lineAmountCents(l.quantityMilli, l.unitPriceCents),
    sortOrder: i,
  }));
}

export type SaveResult = { ok: true; id: number } | { ok: false; errors: FieldErrors };

export function createInvoice(db: Db, input: InvoiceInput): Promise<SaveResult> {
  return db.transaction(async (tx): Promise<SaveResult> => {
    if (await numberExists(tx, input.number)) return { ok: false, errors: { number: `${input.number} is already used.` } };
    if (!await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId)).get())
      return { ok: false, errors: { clientId: "That client no longer exists." } };
    const inv = await tx
      .insert(invoices)
      .values({
        number: input.number,
        clientId: input.clientId,
        issuedOn: input.issuedOn,
        dueOn: input.dueOn,
        notes: input.notes,
      })
      .returning({ id: invoices.id })
      .get();
    await tx.insert(invoiceLineItems).values(lineRows(inv.id, input.lines)).run();
    await advanceCounter(tx, input.number);
    return { ok: true, id: inv.id };
  });
}

export function updateInvoice(db: Db, id: number, input: InvoiceInput): Promise<SaveResult> {
  return db.transaction(async (tx): Promise<SaveResult> => {
    const existing = await tx.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!existing) return { ok: false, errors: { form: "Invoice not found." } };
    if (existing.voidedAt) return { ok: false, errors: { form: "Voided invoices can't be edited." } };
    if (await numberExists(tx, input.number, id)) return { ok: false, errors: { number: `${input.number} is already used.` } };
    const newTotal = input.lines.reduce((s, l) => s + lineAmountCents(l.quantityMilli, l.unitPriceCents), 0);
    const paid = await paidCents(tx, id);
    if (newTotal < paid)
      return {
        ok: false,
        errors: { lines: `The new total is less than the ${(paid / 100).toFixed(2)} already paid. Void a payment first.` },
      };
    await tx.update(invoices)
      .set({
        number: input.number,
        clientId: input.clientId,
        issuedOn: input.issuedOn,
        dueOn: input.dueOn,
        notes: input.notes,
      })
      .where(eq(invoices.id, id))
      .run();
    await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).run();
    await tx.insert(invoiceLineItems).values(lineRows(id, input.lines)).run();
    await advanceCounter(tx, input.number);
    return { ok: true, id };
  });
}

async function paidCents(db: Conn, invoiceId: number): Promise<number> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), isNull(payments.voidedAt)))
    .get();
  return row?.total ?? 0;
}

/** Copy client, lines, and notes into a new draft dated `today`. */
export async function duplicateInvoice(db: Db, id: number, today: DateStr): Promise<SaveResult> {
  const src = await getInvoiceDetail(db, id);
  if (!src) return { ok: false, errors: { form: "Invoice not found." } };
  const terms = Math.max(0, daysBetween(src.invoice.issuedOn, src.invoice.dueOn));
  return createInvoice(db, {
    clientId: src.invoice.clientId,
    number: await suggestInvoiceNumber(db),
    issuedOn: today,
    dueOn: addDays(today, terms),
    notes: src.invoice.notes,
    lines: src.lines.map((l) => ({
      description: l.description,
      quantityMilli: l.quantityMilli,
      unitPriceCents: l.unitPriceCents,
    })),
  });
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently delete an invoice, its lines, and any payments recorded on it. Owner's choice:
 * use voidInvoice() to keep the record. Deleting a paid invoice removes that income from reports.
 */
export function deleteInvoice(db: Db, id: number): Promise<ActionResult> {
  return db.transaction(async (tx): Promise<ActionResult> => {
    const inv = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, id)).get();
    if (!inv) return { ok: false, error: "Invoice not found." };
    await tx.delete(payments).where(eq(payments.invoiceId, id)).run();
    await tx.delete(invoices).where(eq(invoices.id, id)).run(); // line items cascade
    return { ok: true };
  });
}

export async function voidInvoice(db: Db, id: number, reason: string, now = new Date()): Promise<ActionResult> {
  const inv = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.voidedAt) return { ok: true };
  if ((await paidCents(db, id)) > 0) return { ok: false, error: "Void its payments first; money you received still counts as income." };
  await db.update(invoices).set({ voidedAt: now.toISOString(), voidReason: reason }).where(eq(invoices.id, id)).run();
  return { ok: true };
}

export async function unvoidInvoice(db: Db, id: number): Promise<ActionResult> {
  await db.update(invoices).set({ voidedAt: null, voidReason: "" }).where(eq(invoices.id, id)).run();
  return { ok: true };
}

export type InvoiceSummary = {
  id: number;
  number: string;
  clientId: number;
  clientName: string;
  issuedOn: DateStr;
  dueOn: DateStr;
  sentAt: string | null;
  voidedAt: string | null;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: InvoiceStatus;
};

export async function listInvoiceSummaries(db: Db, today: DateStr, opts: { clientId?: number } = {}): Promise<InvoiceSummary[]> {
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientId: invoices.clientId,
      clientName: clients.name,
      issuedOn: invoices.issuedOn,
      dueOn: invoices.dueOn,
      sentAt: invoices.sentAt,
      voidedAt: invoices.voidedAt,
      totalCents: sql<number>`coalesce((select sum(${invoiceLineItems.amountCents}) from ${invoiceLineItems} where ${invoiceLineItems.invoiceId} = ${invoices.id}), 0)`,
      paidCents: sql<number>`coalesce((select sum(${payments.amountCents}) from ${payments} where ${payments.invoiceId} = ${invoices.id} and ${payments.voidedAt} is null), 0)`,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(opts.clientId ? eq(invoices.clientId, opts.clientId) : undefined)
    .orderBy(desc(invoices.issuedOn), desc(invoices.id))
    .all();
  return rows.map((r) => ({ ...r, status: deriveStatus(r, today), balanceCents: balanceCents(r) }));
}

export async function getInvoiceDetail(db: Db, id: number) {
  const invoice = await db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) return null;
  const client = (await db.select().from(clients).where(eq(clients.id, invoice.clientId)).get())!;
  const lines = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id))
    .orderBy(asc(invoiceLineItems.sortOrder), asc(invoiceLineItems.id))
    .all();
  const pays = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.receivedOn), asc(payments.id))
    .all();
  const totalCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const paid = pays.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amountCents, 0);
  return { invoice, client, lines, payments: pays, totalCents, paidCents: paid };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;
