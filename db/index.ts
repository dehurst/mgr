import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import { ensureDefaults } from "./defaults";

// libSQL speaks to a local SQLite file (on the Mac, in tests) or to Turso over the network (on
// Vercel). The schema, SQL, and migrations are the same either way.
export type Db = LibSQLDatabase<typeof schema> & { $client: Client };

const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

export function databasePath(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "./data/ledger.db");
}

/** DATABASE_URL (+ DATABASE_AUTH_TOKEN) for Turso; otherwise the local file at DATABASE_PATH. */
export function databaseUrl(): { url: string; authToken?: string } {
  if (process.env.DATABASE_URL) return { url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN || undefined };
  return { url: `file:${databasePath()}` };
}

export function isLocalUrl(url: string): boolean {
  return url === ":memory:" || url.startsWith("file:");
}

/** Connect without touching the schema. */
export function connect(url: string, authToken?: string): Db {
  if (url.startsWith("file:")) fs.mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
  return drizzle(createClient({ url, authToken }), { schema });
}

/** Apply pending migrations and make sure the default rows exist. Idempotent. */
export async function prepareDb(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  await ensureDefaults(db);
}

/** Open a local database file (or ":memory:") ready to use: migrated, with defaults. */
export async function openDb(file: string): Promise<Db> {
  const url = file === ":memory:" ? file : `file:${path.resolve(/*turbopackIgnore: true*/ file)}`;
  const db = connect(url);
  if (url !== ":memory:") await db.$client.execute("PRAGMA journal_mode = WAL");
  await prepareDb(db);
  return db;
}

/** The configured database (DATABASE_URL or DATABASE_PATH), migrated. For CLI scripts. */
export async function openConfiguredDb(): Promise<{ db: Db; label: string; local: boolean }> {
  const { url, authToken } = databaseUrl();
  if (isLocalUrl(url)) {
    const file = url.slice("file:".length);
    return { db: await openDb(file), label: file, local: true };
  }
  const db = connect(url, authToken);
  await prepareDb(db);
  return { db, label: url, local: false };
}

// One connection per process; cached on globalThis so dev hot-reload doesn't leak handles.
// A local database is migrated on first use. Turso is migrated by `npm run db:migrate` during the
// deploy build, so app instances never race each other to migrate.
const g = globalThis as unknown as { __ledgerDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__ledgerDb ??= (async () => {
    const { url, authToken } = databaseUrl();
    if (isLocalUrl(url)) return openDb(url.slice("file:".length));
    return connect(url, authToken);
  })().catch((e) => {
    g.__ledgerDb = undefined; // let the next request retry
    throw e;
  });
  return g.__ledgerDb;
}
