// Run the app with fake data, separate from your real books: a fresh data/demo.db (and its own
// uploads folder) every time, on its own port. Ctrl+C stops it.
import "./env";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../db";
import { seedDemo } from "../db/seed";
import { today } from "../lib/dates";

const ROOT = process.cwd();
const dbFile = path.join(ROOT, "data", "demo.db");
const uploads = path.join(ROOT, "data", "demo-uploads");
const port = process.env.LEDGER_DEMO_PORT || "4748";
const next = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(f, { force: true });
fs.rmSync(uploads, { recursive: true, force: true });
const db = openDb(dbFile);
seedDemo(db, today());
db.$client.close();

// Overrides .env.local, which Next won't apply over variables that are already set.
const env = { ...process.env, DATABASE_PATH: dbFile, UPLOADS_DIR: uploads, LEDGER_DEMO: "1" };
if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
  console.log("Building the app first (one time)…");
  const build = spawnSync(process.execPath, [next, "build"], { stdio: "inherit", env });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
console.log(`\nDemo running at http://127.0.0.1:${port} with fake data. Your real books aren't touched.\nCtrl+C to stop.\n`);
const child = spawn(process.execPath, [next, "start", "-H", "127.0.0.1", "-p", port], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
