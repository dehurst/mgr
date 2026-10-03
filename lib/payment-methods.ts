// Client-safe labels (no db imports) for payment method values.
import type { ExpensePaymentMethod, PaymentMethod } from "@/db/schema";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  check: "Check",
  venmo: "Venmo",
  cash: "Cash",
  ach_zelle: "ACH / Zelle",
  other: "Other",
};

export const EXPENSE_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
  business_card: "Business card",
  personal_card: "Personal card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  check: "Check",
  other: "Other",
};
