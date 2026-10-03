import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import { clients } from "@/db/schema";
import { createInvoice, getInvoiceDetail, listInvoiceSummaries, voidInvoice } from "./invoices";
import { markSent, markUnsent, parsePaymentForm, recordPayment, voidPayment, type PaymentInput } from "./payments";

let db: Db;
let invoiceId: number;

const pay = (amountCents: number, over: Partial<PaymentInput> = {}): PaymentInput => ({
  receivedOn: "2026-01-10",
  amountCents,
  method: "check",
  reference: "#1234",
  notes: "",
  ...over,
});
const status = (today = "2026-01-12") => listInvoiceSummaries(db, today).find((r) => r.id === invoiceId)!;

beforeEach(() => {
  db = openDb(":memory:");
  const clientId = db.insert(clients).values({ name: "Acme" }).returning().get().id;
  const r = createInvoice(db, {
    clientId,
    number: "INV-1001",
    issuedOn: "2026-01-02",
    dueOn: "2026-01-17",
    notes: "",
    lines: [{ description: "Dev", quantityMilli: 10_000, unitPriceCents: 100_00 }], // $1,000.00
  });
  if (!r.ok) throw new Error();
  invoiceId = r.id;
});

describe("mark as sent", () => {
  it("draft -> sent -> overdue after the due date", () => {
    expect(status().status).toBe("draft");
    expect(markSent(db, invoiceId, "2026-01-03", "2026-01-12").ok).toBe(true);
    expect(status().status).toBe("sent");
    expect(getInvoiceDetail(db, invoiceId)!.invoice.sentAt!.slice(0, 10)).toBe("2026-01-03");
    expect(status("2026-01-18").status).toBe("overdue");
  });

  it("rejects future and invalid dates", () => {
    expect(markSent(db, invoiceId, "2026-01-13", "2026-01-12").ok).toBe(false);
    expect(markSent(db, invoiceId, "2026-02-30", "2026-03-01").ok).toBe(false);
  });

  it("can be undone only while there are no active payments", () => {
    markSent(db, invoiceId, "2026-01-03", "2026-01-12");
    recordPayment(db, invoiceId, pay(100_00));
    expect(markUnsent(db, invoiceId).ok).toBe(false);
    const p = getInvoiceDetail(db, invoiceId)!.payments[0];
    voidPayment(db, p.id);
    expect(markUnsent(db, invoiceId).ok).toBe(true);
    expect(status().status).toBe("draft");
  });
});

describe("payments", () => {
  beforeEach(() => {
    markSent(db, invoiceId, "2026-01-03", "2026-01-12");
  });

  it("partial, then the rest -> paid", () => {
    expect(recordPayment(db, invoiceId, pay(400_00)).ok).toBe(true);
    expect(status()).toMatchObject({ status: "partially_paid", paidCents: 400_00, balanceCents: 600_00 });
    expect(recordPayment(db, invoiceId, pay(600_00, { receivedOn: "2026-01-11" })).ok).toBe(true);
    expect(status()).toMatchObject({ status: "paid", balanceCents: 0 });
  });

  it("partially paid and past due shows overdue for the remaining balance", () => {
    recordPayment(db, invoiceId, pay(400_00));
    expect(status("2026-01-20")).toMatchObject({ status: "overdue", balanceCents: 600_00 });
  });

  it("rejects overpayment, including by one cent", () => {
    expect(recordPayment(db, invoiceId, pay(1000_01)).ok).toBe(false);
    recordPayment(db, invoiceId, pay(999_99));
    expect(recordPayment(db, invoiceId, pay(2)).ok).toBe(false);
    expect(recordPayment(db, invoiceId, pay(1)).ok).toBe(true);
    expect(recordPayment(db, invoiceId, pay(1)).ok).toBe(false); // already paid
  });

  it("voiding a payment restores the balance and status", () => {
    recordPayment(db, invoiceId, pay(1000_00));
    expect(status().status).toBe("paid");
    voidPayment(db, getInvoiceDetail(db, invoiceId)!.payments[0].id);
    expect(status()).toMatchObject({ status: "sent", paidCents: 0, balanceCents: 1000_00 });
    // The voided payment is kept on record.
    expect(getInvoiceDetail(db, invoiceId)!.payments).toHaveLength(1);
  });

  it("can't pay a void invoice", () => {
    voidInvoice(db, invoiceId, "x");
    expect(recordPayment(db, invoiceId, pay(100)).ok).toBe(false);
  });
});

describe("payment on a never-sent invoice", () => {
  it("marks it sent on the payment date", () => {
    expect(recordPayment(db, invoiceId, pay(1000_00, { receivedOn: "2026-01-09" })).ok).toBe(true);
    expect(getInvoiceDetail(db, invoiceId)!.invoice.sentAt!.slice(0, 10)).toBe("2026-01-09");
    expect(status().status).toBe("paid");
  });
});

describe("parsePaymentForm", () => {
  const raw = { receivedOn: "2026-01-10", amount: "1,000.00", method: "venmo", reference: "", notes: "" };
  it("parses cents", () => {
    const r = parsePaymentForm(raw, "2026-01-12");
    expect(r.ok && r.input.amountCents).toBe(100000);
  });
  it.each([
    [{ amount: "0" }, "amount"],
    [{ amount: "-5" }, "amount"],
    [{ amount: "1.005" }, "amount"],
    [{ method: "bitcoin" }, "method"],
    [{ receivedOn: "2026-01-13" }, "receivedOn"],
  ])("rejects %j", (over, field) => {
    const r = parsePaymentForm({ ...raw, ...over }, "2026-01-12");
    expect(!r.ok && r.errors[field]).toBeTruthy();
  });
  it("accepts a payment dated Dec 31 when today is Jan 1", () => {
    expect(parsePaymentForm({ ...raw, receivedOn: "2026-12-31" }, "2027-01-01").ok).toBe(true);
  });
});
