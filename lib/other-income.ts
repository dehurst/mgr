import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { Db } from "@/db";
import { clients, otherIncome } from "@/db/schema";
import { isValidDate, type DateRange, type DateStr } from "./dates";
import type { FieldErrors } from "./form";
import { parseCents, sumCents } from "./money";

export type OtherIncomeInput = {
  receivedOn: DateStr;
  source: string;
  clientId: number | null;
  amountCents: number;
  notes: string;
};

export function parseOtherIncomeForm(
  raw: Record<"receivedOn" | "source" | "clientId" | "amount" | "notes", string>,
  today: DateStr,
): { ok: true; input: OtherIncomeInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!isValidDate(raw.receivedOn)) errors.receivedOn = "Enter a valid date.";
  else if (raw.receivedOn > today) errors.receivedOn = "Can't be in the future.";
  if (!raw.source) errors.source = "Where did it come from?";
  const amountCents = parseCents(raw.amount);
  if (amountCents === null || amountCents <= 0) errors.amount = "Enter an amount greater than zero.";
  const clientId = raw.clientId ? Number(raw.clientId) : null;
  if (clientId !== null && (!Number.isSafeInteger(clientId) || clientId <= 0)) errors.clientId = "Pick a client or leave blank.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, input: { receivedOn: raw.receivedOn, source: raw.source, clientId, amountCents: amountCents!, notes: raw.notes } };
}

/** Voided rows are excluded (the column exists for older records; the UI deletes instead). */
export function listOtherIncome(db: Db, range: DateRange) {
  const rows = db
    .select({
      id: otherIncome.id,
      receivedOn: otherIncome.receivedOn,
      source: otherIncome.source,
      clientId: otherIncome.clientId,
      clientName: clients.name,
      amountCents: otherIncome.amountCents,
      notes: otherIncome.notes,
    })
    .from(otherIncome)
    .leftJoin(clients, eq(clients.id, otherIncome.clientId))
    .where(and(gte(otherIncome.receivedOn, range.from), lte(otherIncome.receivedOn, range.to), isNull(otherIncome.voidedAt)))
    .orderBy(desc(otherIncome.receivedOn), desc(otherIncome.id))
    .all();
  return { rows, totalCents: sumCents(rows.map((r) => r.amountCents)) };
}

export function getOtherIncome(db: Db, id: number) {
  return db.select().from(otherIncome).where(eq(otherIncome.id, id)).get();
}
