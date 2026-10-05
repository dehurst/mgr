import { asc, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db";
import { expenses, payees, TAX_CLASSIFICATIONS, TIN_TYPES, type Payee, type TaxClassification, type TinType } from "@/db/schema";
import { isValidDate, type DateStr } from "./dates";
import { looksLikeEmail, type FieldErrors } from "./form";
import { loadPayeePayments } from "./reports/data";
import { form1099Rows } from "./reports/form-1099";

export { TAX_CLASSIFICATION_LABELS } from "./payee-labels";

export type PayeeInput = {
  name: string;
  businessName: string;
  email: string;
  address: string;
  taxClassification: TaxClassification | null;
  isAttorney: boolean;
  tinType: TinType | null;
  tinLast4: string | null;
  w9ReceivedOn: DateStr | null;
  notes: string;
};

/**
 * Only the last 4 digits of a tax ID are kept: that's all the recipient's copy shows, and the
 * full number is typed into the IRS filing site from the W-9. Pasting a full number is accepted
 * and cut down to 4 digits before saving.
 */
export function parseTinLast4(raw: string): string | null | undefined {
  const digits = raw.replace(/[\s-]/g, "");
  if (digits === "") return null;
  if (/^\d{4}$/.test(digits) || /^\d{9}$/.test(digits)) return digits.slice(-4);
  return undefined;
}

export function parsePayeeForm(
  raw: Record<"name" | "businessName" | "email" | "address" | "taxClassification" | "isAttorney" | "tinType" | "tinLast4" | "w9ReceivedOn" | "notes", string>,
): { ok: true; input: PayeeInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!raw.name) errors.name = "Required.";
  if (raw.email && !looksLikeEmail(raw.email)) errors.email = "Doesn't look like an email address.";
  const taxClassification = raw.taxClassification || null;
  if (taxClassification && !(TAX_CLASSIFICATIONS as readonly string[]).includes(taxClassification)) errors.taxClassification = "Pick one.";
  const tinType = raw.tinType || null;
  if (tinType && !(TIN_TYPES as readonly string[]).includes(tinType)) errors.tinType = "Pick SSN or EIN.";
  const tinLast4 = parseTinLast4(raw.tinLast4);
  if (tinLast4 === undefined) errors.tinLast4 = "Enter the last 4 digits.";
  else if (tinLast4 && !tinType) errors.tinType = "Is it an SSN or an EIN?";
  const w9ReceivedOn = raw.w9ReceivedOn || null;
  if (w9ReceivedOn && !isValidDate(w9ReceivedOn)) errors.w9ReceivedOn = "Enter a valid date.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name: raw.name,
      businessName: raw.businessName,
      email: raw.email,
      address: raw.address,
      taxClassification: taxClassification as TaxClassification | null,
      isAttorney: raw.isAttorney === "on",
      tinType: tinType as TinType | null,
      tinLast4: tinLast4 ?? null,
      w9ReceivedOn,
      notes: raw.notes,
    },
  };
}

export function getPayee(db: Db, id: number): Payee | undefined {
  return db.select().from(payees).where(eq(payees.id, id)).get();
}

/** Every payee with this year's 1099 numbers (archived ones included; the page filters). */
export function listPayeesWithTotals(db: Db, year: number) {
  const { rows, payees: all } = loadPayeePayments(db, { from: `${year}-01-01`, to: `${year}-12-31` });
  const byId = new Map(form1099Rows(all, rows, year).map((r) => [r.payee.id, r]));
  return all
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ payee: p, year: byId.get(p.id) ?? null }));
}

/** Active payees plus (when editing) the expense's current one, for the expense form. */
export function payeeOptions(db: Db, includeId?: number | null) {
  return db
    .select({ id: payees.id, name: payees.name })
    .from(payees)
    .where(includeId ? or(isNull(payees.archivedAt), eq(payees.id, includeId)) : isNull(payees.archivedAt))
    .orderBy(asc(payees.name))
    .all();
}

/** A payee can be deleted only if no expense points at it; otherwise archive. */
export function deletePayee(db: Db, id: number): { ok: true } | { ok: false; error: string } {
  if (db.select({ id: expenses.id }).from(expenses).where(eq(expenses.payeeId, id)).get())
    return { ok: false, error: "This payee has payments recorded. Archive it instead." };
  db.delete(payees).where(eq(payees.id, id)).run();
  return { ok: true };
}
