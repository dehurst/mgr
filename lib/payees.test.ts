import { ne } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import { expenseCategories, expenses, payees } from "@/db/schema";
import { checkPayee } from "./expenses";
import { deletePayee, listPayeesWithTotals, parsePayeeForm, parseTinLast4 } from "./payees";
import { form1099Report } from "./reports";
import { parseTaxId } from "./settings-rules";

const raw = {
  name: "Jane Smith",
  businessName: "",
  email: "",
  address: "",
  taxClassification: "",
  isAttorney: "",
  tinType: "",
  tinLast4: "",
  w9ReceivedOn: "",
  notes: "",
};

describe("parsePayeeForm", () => {
  it("keeps only the last 4 digits of a tax ID, even when the full number is pasted", async () => {
    expect(parseTinLast4("123-45-6789")).toBe("6789");
    expect(parseTinLast4("12-3456789")).toBe("6789");
    expect(parseTinLast4("6789")).toBe("6789");
    expect(parseTinLast4("")).toBeNull();
    expect(parseTinLast4("12345")).toBeUndefined();
    const r = parsePayeeForm({ ...raw, tinType: "ssn", tinLast4: "123-45-6789", isAttorney: "on", taxClassification: "corporation" });
    expect(r.ok && r.input).toMatchObject({ tinLast4: "6789", isAttorney: true, taxClassification: "corporation", w9ReceivedOn: null });
  });

  it.each([
    [{ name: "" }, "name"],
    [{ tinLast4: "1234" }, "tinType"],
    [{ tinLast4: "12a4", tinType: "ssn" }, "tinLast4"],
    [{ taxClassification: "llc" }, "taxClassification"],
    [{ w9ReceivedOn: "2026-02-30" }, "w9ReceivedOn"],
    [{ email: "nope" }, "email"],
  ])("rejects %j", async (over, field) => {
    const r = parsePayeeForm({ ...raw, ...over });
    expect(!r.ok && r.errors[field]).toBeTruthy();
  });
});

describe("parseTaxId", () => {
  it("formats 9 digits as an EIN, keeps an SSN shape, allows blank", async () => {
    expect(parseTaxId("123456789")).toBe("12-3456789");
    expect(parseTaxId("12-3456789")).toBe("12-3456789");
    expect(parseTaxId("123-45-6789")).toBe("123-45-6789");
    expect(parseTaxId("")).toBe("");
    expect(parseTaxId("12-345")).toBeNull();
  });
});

describe("payees in the database", () => {
  let db: Db;
  let cat: number;
  beforeEach(async () => {
    db = await openDb(":memory:");
    cat = (await db.select().from(expenseCategories).where(ne(expenseCategories.scheduleCLine, "personal")).get())!.id;
  });
  const addPayee = async (name: string) => (await db.insert(payees).values({ name, tinType: "ein", tinLast4: "0001" }).returning().get()).id;
  const addPayment = async (payeeId: number, paidOn: string, amountCents: number) =>
    await db.insert(expenses).values({ paidOn, vendor: "x", categoryId: cat, amountCents, paymentMethod: "check", payeeId }).run();

  it("rejects a malformed last-4 at the database level too", async () => {
    await expect(db.insert(payees).values({ name: "x", tinLast4: "123456789" }).run()).rejects.toThrow();
  });

  it("totals a calendar year: Dec 31 counts, Jan 1 of the next year doesn't", async () => {
    const id = await addPayee("Jane");
    await addPayment(id, "2025-12-31", 5_000_00);
    await addPayment(id, "2026-01-01", 1_500_00);
    await addPayment(id, "2026-12-31", 500_00);
    await addPayment(id, "2027-01-01", 9_000_00);
    const r = await form1099Report(db, 2026);
    expect(r.rows[0]).toMatchObject({ reportableCents: 2_000_00, status: "file" });
    expect((await listPayeesWithTotals(db, 2026))[0].year?.reportableCents).toBe(2_000_00);
  });

  it("can't delete a payee with payments; archived payees can't be picked for new expenses", async () => {
    const id = await addPayee("Jane");
    await addPayment(id, "2026-01-01", 100);
    expect((await deletePayee(db, id)).ok).toBe(false);
    const empty = await addPayee("Unused");
    expect((await deletePayee(db, empty)).ok).toBe(true);
    await db.update(payees).set({ archivedAt: "2026-02-01T00:00:00Z" }).run();
    expect(await checkPayee(db, id)).toMatch(/archived/);
    expect(await checkPayee(db, id, id)).toBeNull();
    expect(await checkPayee(db, null)).toBeNull();
  });
});
