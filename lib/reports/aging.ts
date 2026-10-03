import { daysBetween, type DateStr } from "@/lib/dates";
import type { InvoiceSummary } from "@/lib/invoices";
import { sumCents } from "@/lib/money";

export const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

/** Days past due: 0 (or less) on/before the due date is "current". */
export function agingBucket(daysPastDue: number): AgingBucket {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "1-30";
  if (daysPastDue <= 60) return "31-60";
  if (daysPastDue <= 90) return "61-90";
  return "90+";
}

export type AgingRow = {
  id: number;
  number: string;
  clientName: string;
  issuedOn: DateStr;
  dueOn: DateStr;
  daysPastDue: number;
  bucket: AgingBucket;
  balanceCents: number;
};

/**
 * Open receivables as of a date: sent, non-void invoices with a balance.
 * Uses each summary's balance (payments are already netted out).
 */
export function computeAging(summaries: InvoiceSummary[], asOf: DateStr) {
  const rows: AgingRow[] = summaries
    .filter((s) => s.status !== "void" && s.status !== "draft" && s.balanceCents > 0)
    .map((s) => {
      const daysPastDue = Math.max(0, daysBetween(s.dueOn, asOf));
      return {
        id: s.id,
        number: s.number,
        clientName: s.clientName,
        issuedOn: s.issuedOn,
        dueOn: s.dueOn,
        daysPastDue,
        bucket: agingBucket(daysPastDue),
        balanceCents: s.balanceCents,
      };
    })
    .sort((a, b) => b.daysPastDue - a.daysPastDue || a.number.localeCompare(b.number));

  const buckets = Object.fromEntries(
    AGING_BUCKETS.map((b) => [b, sumCents(rows.filter((r) => r.bucket === b).map((r) => r.balanceCents))]),
  ) as Record<AgingBucket, number>;
  const totalCents = sumCents(rows.map((r) => r.balanceCents));
  return { rows, buckets, totalCents, overdueCents: totalCents - buckets.current };
}
