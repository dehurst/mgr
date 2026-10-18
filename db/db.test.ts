import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, PERSONAL_CATEGORY_NAME, PERSONAL_LINE } from "@/lib/schedule-c";
import { ensureDefaults } from "./defaults";
import { openDb } from "./index";
import * as s from "./schema";

describe("database bootstrap", () => {
  it("applies migrations and seeds settings + default categories", async () => {
    const db = await openDb(":memory:");
    const settings = await db.select().from(s.businessSettings).all();
    expect(settings).toHaveLength(1);
    expect(settings[0].nextInvoiceNumber).toBe(1001);
    expect(settings[0].invoiceEmailBody).toContain("{{invoice_number}}");
    const cats = await db.select().from(s.expenseCategories).all();
    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    expect(cats.filter((c) => c.scheduleCLine === PERSONAL_LINE).map((c) => c.name)).toEqual([PERSONAL_CATEGORY_NAME]);
  });

  it("ensureDefaults is idempotent and never re-adds renamed or archived categories", async () => {
    const db = await openDb(":memory:");
    const first = (await db.select().from(s.expenseCategories).where(eq(s.expenseCategories.name, DEFAULT_CATEGORIES[0].name)).get())!;
    await db.update(s.expenseCategories)
      .set({ name: "Renamed", archivedAt: new Date().toISOString() })
      .where(eq(s.expenseCategories.id, first.id))
      .run();
    await ensureDefaults(db);
    await ensureDefaults(db);
    const cats = await db.select().from(s.expenseCategories).all();
    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    expect(cats.find((c) => c.name === first.name)).toBeUndefined();
    expect(await db.select().from(s.businessSettings).all()).toHaveLength(1);
  });

  it("enforces constraints: single settings row, positive amounts, FK restrict", async () => {
    const db = await openDb(":memory:");
    await expect(db.insert(s.businessSettings).values({ id: 2 }).run()).rejects.toThrow();

    const cat = (await db.select().from(s.expenseCategories).get())!;
    const base = { paidOn: "2026-01-01", vendor: "X", categoryId: cat.id, paymentMethod: "cash" as const };
    await expect(db.insert(s.expenses).values({ ...base, amountCents: 0 }).run()).rejects.toThrow();
    await db.insert(s.expenses).values({ ...base, amountCents: 100 }).run();
    // Category with expenses can't be deleted (archive instead).
    await expect(db.delete(s.expenseCategories).where(eq(s.expenseCategories.id, cat.id)).run()).rejects.toThrow();

    const client = await db.insert(s.clients).values({ name: "Acme" }).returning().get();
    const inv = await db
      .insert(s.invoices)
      .values({ number: "INV-1", clientId: client.id, issuedOn: "2026-01-01", dueOn: "2026-01-16" })
      .returning()
      .get();
    await expect(db.insert(s.invoices).values({ number: "INV-1", clientId: client.id, issuedOn: "2026-01-01", dueOn: "2026-01-16" }).run()).rejects.toThrow(); // unique number
    await expect(db.insert(s.invoices).values({ number: "INV-2", clientId: client.id, issuedOn: "2026-02-01", dueOn: "2026-01-16" }).run()).rejects.toThrow(); // due before issue
    await db.insert(s.payments).values({ invoiceId: inv.id, receivedOn: "2026-01-10", amountCents: 500, method: "venmo" }).run();
    await expect(db.delete(s.invoices).where(eq(s.invoices.id, inv.id)).run()).rejects.toThrow(); // has payments
  });
});

describe("databaseUrl", () => {
  it("uses Turso when configured (either variable name), else the local file", async () => {
    const { databaseUrl } = await import("./index");
    expect(databaseUrl({ DATABASE_URL: "libsql://a.turso.io", DATABASE_AUTH_TOKEN: "t" })).toEqual({ url: "libsql://a.turso.io", authToken: "t" });
    expect(databaseUrl({ TURSO_DATABASE_URL: "libsql://b.turso.io", TURSO_AUTH_TOKEN: "u" })).toEqual({ url: "libsql://b.turso.io", authToken: "u" });
    expect(databaseUrl({}).url).toMatch(/^file:.*ledger\.db$/);
  });
});
