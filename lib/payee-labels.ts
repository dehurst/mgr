// Client-safe labels (no db imports) for payee fields.
import type { TaxClassification } from "@/db/schema";

export const TAX_CLASSIFICATION_LABELS: Record<TaxClassification, string> = {
  individual: "Individual / sole proprietor / single-member LLC",
  partnership: "Partnership (incl. LLC taxed as one)",
  corporation: "C or S corporation (incl. LLC taxed as one)",
  other: "Trust, estate, or other",
};
