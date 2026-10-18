// Realistic demo data relative to `today`: 3 clients, ~10 invoices in mixed states, ~10 expenses
// across categories, and a little other income. Used by `npm run demo` and tests.
import type { Db } from "@/db";
import { addDays, addMonths, type DateStr } from "@/lib/dates";
import { createInvoice, suggestInvoiceNumber, voidInvoice } from "@/lib/invoices";
import { markSent, recordPayment } from "@/lib/payments";
import { businessSettings, clients, expenseCategories, expenses, invoices, otherIncome, payees } from "./schema";

export async function hasData(db: Db): Promise<boolean> {
  for (const t of [clients, invoices, expenses, otherIncome, payees]) {
    if ((await db.select().from(t).limit(1).all()).length > 0) return true;
  }
  return false;
}

export async function seedDemo(db: Db, today: DateStr): Promise<void> {
  const d = (days: number) => addDays(today, days);
  const cat = Object.fromEntries((await db.select().from(expenseCategories).all()).map((c) => [c.name, c.id]));

  await db.update(businessSettings)
    .set({
      businessName: "Demo Web Studio, LLC",
      address: "100 Example St\nRaleigh, NC 27601",
      email: "hello@example.com",
      phone: "(555) 010-0100",
      paymentInstructions: "Venmo @demo-studio, or check payable to Demo Web Studio, LLC, mailed to the address above.",
    })
    .run();

  const created = [];
  for (const c of [
    { name: "Acme Corp", contactName: "Jane Doe", email: "ap@acme.example", billingAddress: "1 Main St\nDurham, NC 27701", defaultRateCents: 125_00 },
    { name: "Birch & Co", contactName: "Sam Lee", email: "sam@birch.example", billingAddress: "22 Oak Ave\nCary, NC 27511", defaultRateCents: 110_00 },
    { name: "Cedar Nonprofit", contactName: "Pat Kim", email: "pat@cedar.example", billingAddress: "5 Elm Rd\nApex, NC 27502", defaultRateCents: 90_00 },
  ]) {
    created.push(await db.insert(clients).values(c).returning().get());
  }
  const [acme, birch, cedar] = created;

  const inv = async (clientId: number, rate: number, hours: number[], issuedAgo: number, opts: { sentAgo?: number; pays?: [number, number][]; void?: boolean } = {}) => {
    const issuedOn = d(-issuedAgo);
    const r = await createInvoice(db, {
      clientId,
      number: await suggestInvoiceNumber(db),
      issuedOn,
      dueOn: addDays(issuedOn, 15),
      notes: "Thank you for your business!",
      lines: hours.map((h, i) => ({ description: ["Website development", "Design revisions", "Hosting & maintenance", "Meetings"][i % 4], quantityMilli: h * 1000, unitPriceCents: rate })),
    });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    if (opts.sentAgo !== undefined) await markSent(db, r.id, d(-opts.sentAgo), today);
    for (const [ago, cents] of opts.pays ?? []) await recordPayment(db, r.id, { receivedOn: d(-ago), amountCents: cents, method: ago % 2 ? "check" : "venmo", reference: ago % 2 ? `#${1000 + ago}` : "", notes: "" });
    if (opts.void) await voidInvoice(db, r.id, "Duplicate");
    return r.id;
  };

  // Paid in full (some last year, some this year), partial, overdue, current, draft, void.
  await inv(acme.id, 125_00, [20, 4], 400, { sentAgo: 399, pays: [[380, 3000_00]] });
  await inv(birch.id, 110_00, [12], 200, { sentAgo: 199, pays: [[185, 1320_00]] });
  await inv(acme.id, 125_00, [16, 2], 120, { sentAgo: 119, pays: [[100, 2250_00]] });
  await inv(cedar.id, 90_00, [10], 95, { sentAgo: 94, pays: [[80, 900_00]] });
  await inv(birch.id, 110_00, [8, 1.5], 75, { sentAgo: 74, pays: [[50, 500_00]] }); // partial + overdue
  await inv(acme.id, 125_00, [24], 45, { sentAgo: 44, pays: [[20, 3000_00]] });
  await inv(cedar.id, 90_00, [6], 40, { sentAgo: 39 }); // overdue
  await inv(acme.id, 125_00, [10, 2], 10, { sentAgo: 9 }); // current
  await inv(birch.id, 110_00, [5], 30, { sentAgo: 29, void: true });
  await inv(cedar.id, 90_00, [4], 2); // draft

  const ex = async (ago: number, vendor: string, category: string, cents: number, description = "") =>
    await db.insert(expenses).values({ paidOn: d(-ago), vendor, categoryId: cat[category], amountCents: cents, paymentMethod: ago % 3 ? "business_card" : "personal_card", description }).run();
  await ex(370, "Apple", "Computer & equipment", 1999_00, "MacBook Pro");
  await ex(250, "Adobe", "Software & subscriptions", 659_88, "Creative Cloud annual");
  await ex(200, "Namecheap", "Hosting & domains", 48_16);
  await ex(150, "DigitalOcean", "Hosting & domains", 144_00);
  await ex(120, "NC Secretary of State", "Taxes & licenses", 200_00, "LLC annual report");
  await ex(90, "Delta", "Travel", 412_30, "Client visit");
  await ex(89, "Second Empire", "Meals (50% deductible)", 101_01, "Client dinner");
  await ex(60, "Hiscox", "Insurance", 450_00, "General liability");
  await ex(30, "GitHub", "Software & subscriptions", 48_00);
  await ex(5, "Staples", "Office expense", 37_42);

  // A contractor: two checks this year count toward a 1099; the card payment doesn't.
  const designer = await db
    .insert(payees)
    .values({ name: "Sam Rivera", address: "12 Elm St\nDurham, NC 27701", taxClassification: "individual", tinType: "ssn", tinLast4: "4321", w9ReceivedOn: d(-100) })
    .returning()
    .get();
  const pay = async (ago: number, cents: number, paymentMethod: "check" | "business_card") =>
    await db.insert(expenses).values({ paidOn: d(-ago), vendor: designer.name, categoryId: cat["Contract labor"], amountCents: cents, paymentMethod, payeeId: designer.id, description: "Design work" }).run();
  await pay(70, 1200_00, "check");
  await pay(25, 1000_00, "check");
  await pay(12, 300_00, "business_card");

  await db.insert(otherIncome).values({ receivedOn: d(-160), source: "Workshop speaking fee", amountCents: 500_00 }).run();
  await db.insert(otherIncome).values({ receivedOn: addMonths(today, -6), source: "Referral bonus", clientId: cedar.id, amountCents: 250_00 }).run();
}
