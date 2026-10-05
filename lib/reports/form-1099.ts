// Form 1099-NEC: which payees need one for a calendar year, and for how much. Pure; rows come
// from loadPayeePayments() in data.ts.
import type { ExpensePaymentMethod, Payee } from "@/db/schema";
import { sumCents } from "@/lib/money";
import { splitExpense } from "./data";

/**
 * Box 1 reporting threshold. $600 through 2025; the One Big Beautiful Bill Act raised it to
 * $2,000 for payments made after Dec 31, 2025, inflation-adjusted from 2027 (update when the IRS
 * publishes those amounts; `thresholdIsEstimate` flags years we don't know yet).
 */
export function threshold1099(year: number): { cents: number; isEstimate: boolean } {
  if (year <= 2025) return { cents: 600_00, isEstimate: false };
  return { cents: 2_000_00, isEstimate: year >= 2027 };
}

/**
 * Card and Venmo/PayPal "goods & services" payments are reported by the card company or payment
 * app on Form 1099-K, so they're left off the 1099-NEC. Friends-and-family transfers aren't
 * reported by the app, so they count, like checks, cash, and bank transfers.
 */
const REPORTED_BY_PAYMENT_NETWORK: readonly ExpensePaymentMethod[] = ["business_card", "personal_card", "p2p_goods"];

export function countsToward1099(method: ExpensePaymentMethod): boolean {
  return !REPORTED_BY_PAYMENT_NETWORK.includes(method);
}

/** Corporations don't get a 1099-NEC, except for legal services. Unknown (no W-9) is treated as reportable. */
export function isExemptPayee(p: Pick<Payee, "taxClassification" | "isAttorney">): boolean {
  return p.taxClassification === "corporation" && !p.isAttorney;
}

export type PayeePaymentRow = {
  id: number;
  payeeId: number;
  date: string;
  amountCents: number;
  businessPct: number;
  scheduleCLine: string;
  paymentMethod: ExpensePaymentMethod;
};

export type Form1099Status = "file" | "under_threshold" | "exempt" | "none";

export const FORM_1099_STATUS_LABELS: Record<Form1099Status, string> = {
  file: "File a 1099-NEC",
  under_threshold: "Under threshold",
  exempt: "Not required (corporation)",
  none: "No business payments",
};

export type Form1099Row = {
  payee: Payee;
  /** Box 1: business share of payments that count toward the 1099. */
  reportableCents: number;
  /** Paid by card or Venmo/PayPal goods & services (reported on the payment company's 1099-K). */
  networkCents: number;
  paymentCount: number;
  status: Form1099Status;
  /** What's missing before the form can be filed (only for status "file"). */
  missing: string[];
};

export function form1099Rows(payeeList: Payee[], rows: PayeePaymentRow[], year: number): Form1099Row[] {
  const { cents: min } = threshold1099(year);
  return payeeList
    .map((payee) => {
      const mine = rows.filter((r) => r.payeeId === payee.id);
      const business = mine.map((r) => ({ r, cents: splitExpense(r).businessCents })).filter((x) => x.cents > 0);
      const reportableCents = sumCents(business.filter((x) => countsToward1099(x.r.paymentMethod)).map((x) => x.cents));
      const networkCents = sumCents(business.filter((x) => !countsToward1099(x.r.paymentMethod)).map((x) => x.cents));
      const status: Form1099Status =
        business.length === 0 ? "none" : isExemptPayee(payee) ? "exempt" : reportableCents >= min ? "file" : "under_threshold";
      const missing =
        status !== "file"
          ? []
          : [
              !payee.w9ReceivedOn && "W-9",
              !(payee.tinType && payee.tinLast4) && "tax ID",
              !payee.address.trim() && "address",
            ].filter((x): x is string => !!x);
      return { payee, reportableCents, networkCents, paymentCount: business.length, status, missing };
    })
    .filter((r) => r.status !== "none" || !r.payee.archivedAt)
    .sort((a, b) => b.reportableCents - a.reportableCents || a.payee.name.localeCompare(b.payee.name));
}

/** Recipient TIN as allowed on the recipient's copy: only the last four digits shown. */
export function maskedTin(p: Pick<Payee, "tinType" | "tinLast4">): string {
  if (!p.tinLast4) return "";
  return p.tinType === "ein" ? `XX-XXX${p.tinLast4}` : `XXX-XX-${p.tinLast4}`;
}
