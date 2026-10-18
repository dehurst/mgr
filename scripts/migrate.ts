// Apply migrations (and default rows) to the configured database: the local file, or Turso when
// DATABASE_URL is set. Runs during the Vercel build, before the new version goes live.
import "./env";
import { openConfiguredDb } from "../db";

async function main() {
  const { db, label } = await openConfiguredDb();
  db.$client.close();
  console.log(`Database ready: ${label}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
