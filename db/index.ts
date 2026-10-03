import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { ensureDefaults } from "./defaults";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

export function databasePath(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "./data/ledger.db");
}

/** Open a database, apply pending migrations, and make sure default rows exist. */
export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  ensureDefaults(db);
  return db;
}

// One connection per process; cached on globalThis so dev hot-reload doesn't leak handles.
const g = globalThis as unknown as { __ledgerDb?: Db };

export function getDb(): Db {
  g.__ledgerDb ??= openDb(databasePath());
  return g.__ledgerDb;
}
