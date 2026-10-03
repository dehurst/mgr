// Realistic demo data relative to `today`: 3 clients, ~10 invoices in mixed states, ~10 expenses
// across categories, and a little other income. Used by `npm run demo` and tests.
import type { Db } from "@/db";
import { addDays, addMonths, type DateStr } from "@/lib/dates";
import { createInvoice, suggestInvoiceNumber, voidInvoice } from "@/lib/invoices";
import { markSent, recordPayment } from "@/lib/payments";
import { businessSettings, clients, expenseCategories, expenses, invoices, otherIncome } from "./schema";

export function hasData(db: Db): boolean {
  return [clients, invoices, expenses, otherIncome].some((t) => db.select().from(t).limit(1).all().length > 0);
}

export function seedDemo(db: Db, today: DateStr): void {
  const d = (days: number) => addDays(today, days);
  const cat = Object.fromEntries(db.select().from(expenseCategories).all().map((c) => [c.name, c.id]));

  db.update(businessSettings)
    .set({
      businessName: "Demo Web Studio, LLC",
      address: "100 Example St\nRaleigh, NC 27601",
      email: "hello@example.com",
      phone: "(555) 010-0100",
      paymentInstructions: "Venmo @demo-studio, or check payable to Demo Web Studio, LLC, mailed to the address above.",
    })
    .run();

  const [acme, birch, cedar] = [
    { name: "Acme Corp", contactName: "Jane Doe", email: "ap@acme.example", billingAddress: "1 Main St\nDurham, NC 27701", defaultRateCents: 125_00 },
    { name: "Birch & Co", contactName: "Sam Lee", email: "sam@birch.example", billingAddress: "22 Oak Ave\nCary, NC 27511", defaultRateCents: 110_00 },
    { name: "Cedar Nonprofit", contactName: "Pat Kim", email: "pat@cedar.example", billingAddress: "5 Elm Rd\nApex, NC 27502", defaultRateCents: 90_00 },
  ].map((c) => db.insert(clients).values(c).returning().get());

  const inv = (clientId: number, rate: number, hours: number[], issuedAgo: number, opts: { sentAgo?: number; pays?: [number, number][]; void?: boolean } = {}) => {
    const issuedOn = d(-issuedAgo);
    const r = createInvoice(db, {
      clientId,
      number: suggestInvoiceNumber(db),
      issuedOn,
      dueOn: addDays(issuedOn, 15),
      notes: "Thank you for your business!",
      lines: hours.map((h, i) => ({ description: ["Website development", "Design revisions", "Hosting & maintenance", "Meetings"][i % 4], quantityMilli: h * 1000, unitPriceCents: rate })),
    });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    if (opts.sentAgo !== undefined) markSent(db, r.id, d(-opts.sentAgo), today);
    for (const [ago, cents] of opts.pays ?? []) recordPayment(db, r.id, { receivedOn: d(-ago), amountCents: cents, method: ago % 2 ? "check" : "venmo", reference: ago % 2 ? `#${1000 + ago}` : "", notes: "" });
    if (opts.void) voidInvoice(db, r.id, "Duplicate");
    return r.id;
  };

  // Paid in full (some last year, some this year), partial, overdue, current, draft, void.
  inv(acme.id, 125_00, [20, 4], 400, { sentAgo: 399, pays: [[380, 3000_00]] });
  inv(birch.id, 110_00, [12], 200, { sentAgo: 199, pays: [[185, 1320_00]] });
  inv(acme.id, 125_00, [16, 2], 120, { sentAgo: 119, pays: [[100, 2250_00]] });
  inv(cedar.id, 90_00, [10], 95, { sentAgo: 94, pays: [[80, 900_00]] });
  inv(birch.id, 110_00, [8, 1.5], 75, { sentAgo: 74, pays: [[50, 500_00]] }); // partial + overdue
  inv(acme.id, 125_00, [24], 45, { sentAgo: 44, pays: [[20, 3000_00]] });
  inv(cedar.id, 90_00, [6], 40, { sentAgo: 39 }); // overdue
  inv(acme.id, 125_00, [10, 2], 10, { sentAgo: 9 }); // current
  inv(birch.id, 110_00, [5], 30, { sentAgo: 29, void: true });
  inv(cedar.id, 90_00, [4], 2); // draft

  const ex = (ago: number, vendor: string, category: string, cents: number, description = "") =>
    db.insert(expenses).values({ paidOn: d(-ago), vendor, categoryId: cat[category], amountCents: cents, paymentMethod: ago % 3 ? "business_card" : "personal_card", description }).run();
  ex(370, "Apple", "Computer & equipment", 1999_00, "MacBook Pro");
  ex(250, "Adobe", "Software & subscriptions", 659_88, "Creative Cloud annual");
  ex(200, "Namecheap", "Hosting & domains", 48_16);
  ex(150, "DigitalOcean", "Hosting & domains", 144_00);
  ex(120, "NC Secretary of State", "Taxes & licenses", 200_00, "LLC annual report");
  ex(90, "Delta", "Travel", 412_30, "Client visit");
  ex(89, "Second Empire", "Meals (50% deductible)", 101_01, "Client dinner");
  ex(60, "Hiscox", "Insurance", 450_00, "General liability");
  ex(30, "GitHub", "Software & subscriptions", 48_00);
  ex(5, "Staples", "Office expense", 37_42);

  db.insert(otherIncome).values({ receivedOn: d(-160), source: "Workshop speaking fee", amountCents: 500_00 }).run();
  db.insert(otherIncome).values({ receivedOn: addMonths(today, -6), source: "Referral bonus", clientId: cedar.id, amountCents: 250_00 }).run();
}
