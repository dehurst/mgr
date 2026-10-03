// Fill DATABASE_PATH with demo data. Refuses if the database already has clients, invoices,
// expenses, or income, so it can never mix fake data into real books.
import "./env";
import { databasePath, openDb } from "../db";
import { hasData, seedDemo } from "../db/seed";
import { today } from "../lib/dates";

const file = databasePath();
const db = openDb(file);
if (hasData(db)) {
  console.error(`Refusing to seed: ${file} already has data.`);
  process.exit(1);
}
seedDemo(db, today());
db.$client.close();
console.log(`Demo data added to ${file}`);
