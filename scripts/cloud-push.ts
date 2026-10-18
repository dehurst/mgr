// One-time move to the cloud: copies the Mac's database (DATABASE_PATH) into Turso and its
// receipts/logo into private Vercel Blob storage, then checks that every table matches.
// Cloud settings come from .env.cloud (never committed):
//   DATABASE_URL=libsql://...   DATABASE_AUTH_TOKEN=...   BLOB_READ_WRITE_TOKEN=...
// Usage: npm run cloud:push            (refuses if the cloud database already has records)
//        npm run cloud:push -- --replace   (overwrites them, after you type "replace")
import "./env";
import fs from "node:fs";
import readline from "node:readline/promises";
import { list, put } from "@vercel/blob";
import { connect, databasePath, openDb, prepareDb } from "../db";
import { hasData } from "../db/seed";
import { copyAllRows } from "../lib/backup";
import { today } from "../lib/dates";
import { exportTables } from "../lib/export";
import { listUploads, mimeForPath, readUpload } from "../lib/uploads";

function cloudEnv(): Record<string, string> {
  if (!fs.existsSync(".env.cloud")) throw new Error("Create .env.cloud first (see README: Moving to the cloud).");
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.cloud", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  for (const k of ["DATABASE_URL", "DATABASE_AUTH_TOKEN", "BLOB_READ_WRITE_TOKEN"]) {
    if (!env[k]) throw new Error(`.env.cloud is missing ${k}.`);
  }
  // file: is accepted so the script can be tried against a local copy.
  if (!/^(libsql|file):/.test(env.DATABASE_URL)) throw new Error("DATABASE_URL should start with libsql:// (from the Turso dashboard).");
  return env;
}

async function main(): Promise<number> {
  const cloud = cloudEnv();
  const local = await openDb(databasePath());
  const remote = connect(cloud.DATABASE_URL, cloud.DATABASE_AUTH_TOKEN);
  console.log(`From: ${databasePath()}\nTo:   ${cloud.DATABASE_URL}\n`);
  await prepareDb(remote);

  if (await hasData(remote)) {
    if (!process.argv.includes("--replace")) {
      console.error("The cloud database already has records. Nothing was changed.\nTo overwrite them with the Mac's data: npm run cloud:push -- --replace");
      return 1;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('This replaces everything in the cloud database. Type "replace" to continue: ');
    rl.close();
    if (answer.trim() !== "replace") {
      console.log("Cancelled. Nothing was changed.");
      return 1;
    }
  }

  console.log("Copying the database…");
  const counts = await copyAllRows(local, remote);
  for (const [table, n] of Object.entries(counts)) console.log(`  ${table.padEnd(20)} ${n}`);

  // Every table, exported the same way from both sides, must match exactly.
  const [a, b] = [JSON.stringify(await exportTables(local, today())), JSON.stringify(await exportTables(remote, today()))];
  if (a !== b) {
    console.error("\nThe cloud copy doesn't match the Mac's data. Don't switch over yet; send me this output.");
    return 1;
  }
  console.log("  Checked: every table matches.\n");

  const files = await listUploads();
  console.log(`Uploading ${files.length} file(s) (receipts and logo)…`);
  for (const rel of files) {
    const file = await readUpload(rel);
    if (!file) throw new Error(`Couldn't read ${rel}`);
    await put(rel, Buffer.from(file.data), {
      access: "private",
      contentType: mimeForPath(rel),
      addRandomSuffix: false,
      allowOverwrite: true,
      token: cloud.BLOB_READ_WRITE_TOKEN,
    });
  }
  const uploaded = new Set<string>();
  let cursor: string | undefined;
  if (files.length) do {
    const page = await list({ cursor, token: cloud.BLOB_READ_WRITE_TOKEN });
    page.blobs.forEach((x) => uploaded.add(x.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const missing = files.filter((f) => !uploaded.has(f));
  if (missing.length) {
    console.error(`These files didn't arrive: ${missing.join(", ")}`);
    return 1;
  }
  console.log("  Checked: every file is in the cloud.\n\nDone. Your Mac copy is untouched; keep it until you're happy with the online version.");
  local.$client.close();
  remote.$client.close();
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
