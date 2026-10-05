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
  it("keeps only the last 4 digits of a tax ID, even when the full number is pasted", () => {
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
  ])("rejects %j", (over, field) => {
    const r = parsePayeeForm({ ...raw, ...over });
    expect(!r.ok && r.errors[field]).toBeTruthy();
  });
});

describe("parseTaxId", () => {
  it("formats 9 digits as an EIN, keeps an SSN shape, allows blank", () => {
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
  beforeEach(() => {
    db = openDb(":memory:");
    cat = db.select().from(expenseCategories).where(ne(expenseCategories.scheduleCLine, "personal")).get()!.id;
  });
  const addPayee = (name: string) => db.insert(payees).values({ name, tinType: "ein", tinLast4: "0001" }).returning().get().id;
  const addPayment = (payeeId: number, paidOn: string, amountCents: number) =>
    db.insert(expenses).values({ paidOn, vendor: "x", categoryId: cat, amountCents, paymentMethod: "check", payeeId }).run();

  it("rejects a malformed last-4 at the database level too", () => {
    expect(() => db.insert(payees).values({ name: "x", tinLast4: "123456789" }).run()).toThrow();
  });

  it("totals a calendar year: Dec 31 counts, Jan 1 of the next year doesn't", () => {
    const id = addPayee("Jane");
    addPayment(id, "2025-12-31", 5_000_00);
    addPayment(id, "2026-01-01", 1_500_00);
    addPayment(id, "2026-12-31", 500_00);
    addPayment(id, "2027-01-01", 9_000_00);
    const r = form1099Report(db, 2026);
    expect(r.rows[0]).toMatchObject({ reportableCents: 2_000_00, status: "file" });
    expect(listPayeesWithTotals(db, 2026)[0].year?.reportableCents).toBe(2_000_00);
  });

  it("can't delete a payee with payments; archived payees can't be picked for new expenses", () => {
    const id = addPayee("Jane");
    addPayment(id, "2026-01-01", 100);
    expect(deletePayee(db, id).ok).toBe(false);
    const empty = addPayee("Unused");
    expect(deletePayee(db, empty).ok).toBe(true);
    db.update(payees).set({ archivedAt: "2026-02-01T00:00:00Z" }).run();
    expect(checkPayee(db, id)).toMatch(/archived/);
    expect(checkPayee(db, id, id)).toBeNull();
    expect(checkPayee(db, null)).toBeNull();
  });
});
