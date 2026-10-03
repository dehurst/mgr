import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import { businessSettings, clients, invoices, payments } from "@/db/schema";
import { deleteClient, listClientsWithTotals } from "./clients";
import {
  createInvoice,
  deleteDraftInvoice,
  duplicateInvoice,
  getInvoiceDetail,
  listInvoiceSummaries,
  parseInvoiceForm,
  suggestInvoiceNumber,
  updateInvoice,
  voidInvoice,
  type InvoiceInput,
} from "./invoices";

let db: Db;
let clientId: number;

function input(over: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    clientId,
    number: suggestInvoiceNumber(db),
    issuedOn: "2026-01-02",
    dueOn: "2026-01-17",
    notes: "",
    lines: [{ description: "Development", quantityMilli: 1500, unitPriceCents: 8533 }],
    ...over,
  };
}

function create(over: Partial<InvoiceInput> = {}): number {
  const r = createInvoice(db, input(over));
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.id;
}

beforeEach(() => {
  db = openDb(":memory:");
  clientId = db.insert(clients).values({ name: "Acme" }).returning().get().id;
});

describe("parseInvoiceForm", () => {
  const raw = {
    clientId: "1",
    number: "INV-1001",
    issuedOn: "2026-01-02",
    dueOn: "2026-01-17",
    notes: "",
    linesJson: JSON.stringify([
      { description: "Dev", hours: "1.5", rate: "85.33" },
      { description: "", hours: "", rate: "" },
    ]),
  };

  it("parses hours and rate into integers and skips blank rows", () => {
    const r = parseInvoiceForm(raw);
    expect(r.ok && r.input.lines).toEqual([{ description: "Dev", quantityMilli: 1500, unitPriceCents: 8533 }]);
  });

  it.each([
    [{ dueOn: "2026-01-01" }, "dueOn"],
    [{ issuedOn: "2026-02-30" }, "issuedOn"],
    [{ clientId: "" }, "clientId"],
    [{ number: "" }, "number"],
    [{ linesJson: "[]" }, "lines"],
    [{ linesJson: JSON.stringify([{ description: "x", hours: "1.2345", rate: "10" }]) }, "lines"],
    [{ linesJson: JSON.stringify([{ description: "x", hours: "1", rate: "-5" }]) }, "lines"],
    [{ linesJson: JSON.stringify([{ description: "", hours: "1", rate: "5" }]) }, "lines"],
    [{ linesJson: "not json" }, "lines"],
  ])("rejects %j", (over, field) => {
    const r = parseInvoiceForm({ ...raw, ...over });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field]).toBeTruthy();
  });
});

describe("numbering", () => {
  it("assigns from settings and advances the counter", () => {
    expect(suggestInvoiceNumber(db)).toBe("INV-1001");
    create();
    expect(suggestInvoiceNumber(db)).toBe("INV-1002");
  });

  it("rejects duplicate numbers", () => {
    create({ number: "INV-1001" });
    const r = createInvoice(db, input({ number: "INV-1001" }));
    expect(r.ok).toBe(false);
  });

  it("a hand-entered higher number moves the counter past it", () => {
    create({ number: "INV-1050" });
    expect(suggestInvoiceNumber(db)).toBe("INV-1051");
  });

  it("a hand-entered old QBO number doesn't move the counter back", () => {
    db.update(businessSettings).set({ nextInvoiceNumber: 1042 }).where(eq(businessSettings.id, 1)).run();
    create({ number: "INV-1030" });
    expect(suggestInvoiceNumber(db)).toBe("INV-1042");
  });

  it("skips numbers that already exist", () => {
    create({ number: "INV-1001-old" });
    db.insert(invoices).values({ number: "INV-1001", clientId, issuedOn: "2026-01-01", dueOn: "2026-01-01" }).run();
    expect(suggestInvoiceNumber(db)).toBe("INV-1002");
  });

  it("deleted drafts leave gaps (numbers are not reused)", () => {
    const id = create();
    expect(deleteDraftInvoice(db, id).ok).toBe(true);
    expect(suggestInvoiceNumber(db)).toBe("INV-1002");
  });
});

describe("totals and editing", () => {
  it("stores rounded line amounts and totals them", () => {
    const id = create({
      lines: [
        { description: "a", quantityMilli: 1500, unitPriceCents: 8533 },
        { description: "b", quantityMilli: 250, unitPriceCents: 8533 },
      ],
    });
    const d = getInvoiceDetail(db, id)!;
    expect(d.lines.map((l) => l.amountCents)).toEqual([12800, 2133]);
    expect(d.totalCents).toBe(14933);
  });

  it("replaces lines on update", () => {
    const id = create();
    const r = updateInvoice(db, id, input({ number: "INV-1001", lines: [{ description: "new", quantityMilli: 2000, unitPriceCents: 10000 }] }));
    expect(r.ok).toBe(true);
    const d = getInvoiceDetail(db, id)!;
    expect(d.lines).toHaveLength(1);
    expect(d.totalCents).toBe(20000);
  });

  it("won't drop the total below what's already been paid", () => {
    const id = create({ lines: [{ description: "a", quantityMilli: 1000, unitPriceCents: 10000 }] });
    db.insert(payments).values({ invoiceId: id, receivedOn: "2026-01-05", amountCents: 8000, method: "check" }).run();
    const r = updateInvoice(db, id, input({ number: "INV-1001", lines: [{ description: "a", quantityMilli: 500, unitPriceCents: 10000 }] }));
    expect(r.ok).toBe(false);
  });
});

describe("duplicate", () => {
  it("copies client, lines, and notes into a new draft dated today with the same terms", () => {
    const id = create({ notes: "Thanks!", issuedOn: "2026-01-02", dueOn: "2026-01-17" });
    db.update(invoices).set({ sentAt: "2026-01-02T00:00:00Z" }).where(eq(invoices.id, id)).run();
    const r = duplicateInvoice(db, id, "2026-02-01");
    expect(r.ok).toBe(true);
    const d = getInvoiceDetail(db, (r as { id: number }).id)!;
    expect(d.invoice.number).toBe("INV-1002");
    expect(d.invoice.issuedOn).toBe("2026-02-01");
    expect(d.invoice.dueOn).toBe("2026-02-16");
    expect(d.invoice.sentAt).toBeNull();
    expect(d.invoice.notes).toBe("Thanks!");
    expect(d.totalCents).toBe(12800);
  });
});

describe("delete and void rules", () => {
  it("can't delete a sent invoice", () => {
    const id = create();
    db.update(invoices).set({ sentAt: "2026-01-02T00:00:00Z" }).where(eq(invoices.id, id)).run();
    expect(deleteDraftInvoice(db, id).ok).toBe(false);
  });

  it("can't void an invoice with active payments, can after voiding them", () => {
    const id = create();
    const p = db.insert(payments).values({ invoiceId: id, receivedOn: "2026-01-05", amountCents: 500, method: "venmo" }).returning().get();
    expect(voidInvoice(db, id, "mistake").ok).toBe(false);
    db.update(payments).set({ voidedAt: "2026-01-06T00:00:00Z" }).where(eq(payments.id, p.id)).run();
    expect(voidInvoice(db, id, "mistake").ok).toBe(true);
    expect(listInvoiceSummaries(db, "2026-01-10")[0].status).toBe("void");
  });
});

describe("summaries and client totals", () => {
  it("derives status and excludes drafts and voids from billed totals", () => {
    const sent = create({ dueOn: "2026-01-17" });
    db.update(invoices).set({ sentAt: "2026-01-02T00:00:00Z" }).where(eq(invoices.id, sent)).run();
    db.insert(payments).values({ invoiceId: sent, receivedOn: "2026-01-05", amountCents: 2800, method: "check" }).run();
    db.insert(payments).values({ invoiceId: sent, receivedOn: "2026-01-06", amountCents: 9999, method: "check", voidedAt: "x" }).run();
    create(); // draft
    const v = create();
    voidInvoice(db, v, "dupe");

    const rows = listInvoiceSummaries(db, "2026-01-20");
    const s = rows.find((r) => r.id === sent)!;
    expect(s.paidCents).toBe(2800);
    expect(s.balanceCents).toBe(10000);
    expect(s.status).toBe("overdue");

    const [acme] = listClientsWithTotals(db, "2026-01-20");
    expect(acme.totals).toEqual({ billedCents: 12800, paidCents: 2800, balanceCents: 10000, overdueCents: 10000, draftCount: 1 });
  });

  it("clients with invoices can't be deleted; empty ones can", () => {
    create();
    expect(deleteClient(db, clientId).ok).toBe(false);
    const other = db.insert(clients).values({ name: "Empty" }).returning().get().id;
    expect(deleteClient(db, other).ok).toBe(true);
  });
});
