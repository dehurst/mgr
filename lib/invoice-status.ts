import type { DateStr } from "./dates";
import { lineAmountCents, sumCents } from "./money";

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void";

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const INVOICE_STATUSES = Object.keys(STATUS_LABELS) as InvoiceStatus[];

export type StatusInput = {
  sentAt: string | null;
  voidedAt: string | null;
  dueOn: DateStr;
  totalCents: number;
  /** Sum of non-voided payments. */
  paidCents: number;
};

/**
 * The single source of truth for invoice status (see CLAUDE.md #5).
 * `overdue` takes precedence over `partially_paid` for the primary status; use
 * `isOverdue()` when you need both facts.
 */
export function deriveStatus(inv: StatusInput, today: DateStr): InvoiceStatus {
  if (inv.voidedAt) return "void";
  if (!inv.sentAt) return "draft";
  const balance = inv.totalCents - inv.paidCents;
  if (balance <= 0) return "paid";
  if (inv.dueOn < today) return "overdue";
  if (inv.paidCents > 0) return "partially_paid";
  return "sent";
}

export function isOverdue(inv: StatusInput, today: DateStr): boolean {
  return !inv.voidedAt && !!inv.sentAt && inv.totalCents - inv.paidCents > 0 && inv.dueOn < today;
}

/** Amount still owed. Void and draft invoices owe nothing. Never negative. */
export function balanceCents(inv: StatusInput): number {
  if (inv.voidedAt || !inv.sentAt) return 0;
  return Math.max(0, inv.totalCents - inv.paidCents);
}

export type LineInput = { quantityMilli: number; unitPriceCents: number };

export function invoiceTotalCents(lines: LineInput[]): number {
  return sumCents(lines.map((l) => lineAmountCents(l.quantityMilli, l.unitPriceCents)));
}
