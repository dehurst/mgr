import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/schedule-c";
import { ensureDefaults } from "./defaults";
import { openDb } from "./index";
import * as s from "./schema";

describe("database bootstrap", () => {
  it("applies migrations and seeds settings + default categories", () => {
    const db = openDb(":memory:");
    const settings = db.select().from(s.businessSettings).all();
    expect(settings).toHaveLength(1);
    expect(settings[0].nextInvoiceNumber).toBe(1001);
    expect(settings[0].invoiceEmailBody).toContain("{{invoice_number}}");
    expect(db.select().from(s.expenseCategories).all()).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it("ensureDefaults is idempotent and never re-adds renamed or archived categories", () => {
    const db = openDb(":memory:");
    const first = db.select().from(s.expenseCategories).get()!;
    db.update(s.expenseCategories)
      .set({ name: "Renamed", archivedAt: new Date().toISOString() })
      .where(eq(s.expenseCategories.id, first.id))
      .run();
    ensureDefaults(db);
    ensureDefaults(db);
    const cats = db.select().from(s.expenseCategories).all();
    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(cats.find((c) => c.name === first.name)).toBeUndefined();
    expect(db.select().from(s.businessSettings).all()).toHaveLength(1);
  });

  it("enforces constraints: single settings row, positive amounts, FK restrict", () => {
    const db = openDb(":memory:");
    expect(() => db.insert(s.businessSettings).values({ id: 2 }).run()).toThrow();

    const cat = db.select().from(s.expenseCategories).get()!;
    const base = { paidOn: "2026-01-01", vendor: "X", categoryId: cat.id, paymentMethod: "cash" as const };
    expect(() => db.insert(s.expenses).values({ ...base, amountCents: 0 }).run()).toThrow();
    db.insert(s.expenses).values({ ...base, amountCents: 100 }).run();
    // Category with expenses can't be deleted (archive instead).
    expect(() => db.delete(s.expenseCategories).where(eq(s.expenseCategories.id, cat.id)).run()).toThrow();

    const client = db.insert(s.clients).values({ name: "Acme" }).returning().get();
    const inv = db
      .insert(s.invoices)
      .values({ number: "INV-1", clientId: client.id, issuedOn: "2026-01-01", dueOn: "2026-01-16" })
      .returning()
      .get();
    expect(() =>
      db.insert(s.invoices).values({ number: "INV-1", clientId: client.id, issuedOn: "2026-01-01", dueOn: "2026-01-16" }).run(),
    ).toThrow(); // unique number
    expect(() =>
      db.insert(s.invoices).values({ number: "INV-2", clientId: client.id, issuedOn: "2026-02-01", dueOn: "2026-01-16" }).run(),
    ).toThrow(); // due before issue
    db.insert(s.payments).values({ invoiceId: inv.id, receivedOn: "2026-01-10", amountCents: 500, method: "venmo" }).run();
    expect(() => db.delete(s.invoices).where(eq(s.invoices.id, inv.id)).run()).toThrow(); // has payments
  });
});
