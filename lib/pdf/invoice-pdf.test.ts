import { describe, expect, it } from "vitest";
import { openDb } from "@/db";
import { businessSettings, clients, invoices } from "@/db/schema";
import { createInvoice, getInvoiceDetail } from "@/lib/invoices";
import { invoicePdfFilename, renderInvoicePdf } from "./invoice-pdf";

describe("invoice PDF", () => {
  it("renders a valid PDF for a multi-line invoice", async () => {
    const db = openDb(":memory:");
    const settings = db.update(businessSettings).set({ businessName: "Test Co", paymentInstructions: "Check" }).returning().get();
    const clientId = db.insert(clients).values({ name: "Acme", billingAddress: "1 Main St" }).returning().get().id;
    const r = createInvoice(db, {
      clientId,
      number: "INV-1001",
      issuedOn: "2026-01-02",
      dueOn: "2026-01-17",
      notes: "Thanks",
      lines: Array.from({ length: 40 }, (_, i) => ({ description: `Task ${i}`, quantityMilli: 1500, unitPriceCents: 8533 })),
    });
    if (!r.ok) throw new Error("create failed");
    db.update(invoices).set({ voidedAt: "2026-01-03T00:00:00Z" }).run();
    const buf = await renderInvoicePdf({ detail: getInvoiceDetail(db, r.id)!, settings, logoAbsPath: null });
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("builds a safe filename", () => {
    expect(invoicePdfFilename("INV-1001", "DEHurst Enterprises, LLC")).toBe("INV-1001 - DEHurst Enterprises LLC.pdf");
    expect(invoicePdfFilename("INV/../1", "")).toBe("INV..1.pdf");
  });
});
