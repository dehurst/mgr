// Client-safe helpers for showing and naming receipt files.

export type ReceiptKind = "pdf" | "image";

export function receiptKind(receiptPath: string): ReceiptKind {
  return receiptPath.toLowerCase().endsWith(".pdf") ? "pdf" : "image";
}

/** Download name like "Receipt 2026-03-01 Adobe 59.99.pdf" (ASCII-safe for the header). */
export function receiptFilename(e: { paidOn: string; vendor: string; amountCents: number; receiptPath: string }): string {
  const ext = e.receiptPath.slice(e.receiptPath.lastIndexOf(".")).toLowerCase();
  const vendor = e.vendor.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  const amount = `${Math.floor(e.amountCents / 100)}.${String(e.amountCents % 100).padStart(2, "0")}`;
  return `Receipt ${e.paidOn}${vendor ? ` ${vendor}` : ""} ${amount}${ext}`;
}
