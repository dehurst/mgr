// Fill the configured database with demo data. Refuses if it already has clients, invoices,
// expenses, income, or payees, so it can never mix fake data into real books.
import "./env";
import { openConfiguredDb } from "../db";
import { hasData, seedDemo } from "../db/seed";
import { today } from "../lib/dates";

async function main(): Promise<number> {
  const { db, label } = await openConfiguredDb();
  try {
    if (await hasData(db)) {
      console.error(`Refusing to seed: ${label} already has data.`);
      return 1;
    }
    await seedDemo(db, today());
    console.log(`Demo data added to ${label}`);
    return 0;
  } finally {
    db.$client.close();
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
