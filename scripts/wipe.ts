// Erase everything in DATABASE_PATH, after typing its filename to confirm. A safety copy of the
// database is saved next to it first. Safe to run while the app is running.
import "./env";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { databasePath, openDb } from "../db";
import { wipeData } from "../db/wipe";

async function main(): Promise<number> {
  const file = databasePath();
  if (!fs.existsSync(file)) {
    console.error(`No database at ${file}. Nothing to wipe.`);
    return 1;
  }
  const name = path.basename(file);
  console.log(`\nThis erases ALL invoices, payments, expenses, income, clients, payees, and settings in:\n  ${file}\n`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type ${name} to confirm (anything else cancels): `);
  rl.close();
  if (answer.trim() !== name) {
    console.log("Cancelled. Nothing was changed.");
    return 1;
  }

  const db = openDb(file);
  const copy = `${file}.before-wipe-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await db.$client.backup(copy);
  wipeData(db);
  db.$client.close();
  console.log(`\nWiped. A copy of what was there is saved at:\n  ${copy}`);
  console.log("Receipts and your logo in the uploads folder were left alone.");
  return 0;
}

main().then((code) => process.exit(code));
