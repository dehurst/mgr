// Client-safe labels (no db imports) for payment method values.
import type { PaymentMethod } from "@/db/schema";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  check: "Check",
  venmo: "Venmo",
  cash: "Cash",
  ach_zelle: "ACH / Zelle",
  other: "Other",
};
