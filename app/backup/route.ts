import { getDb } from "@/db";
import { buildBackupZip } from "@/lib/backup";
import { today } from "@/lib/dates";
import { listUploads } from "@/lib/uploads";

// GET /backup -> the complete books (SQLite file + CSVs) as a zip, for keeping a copy yourself.
export async function GET() {
  const db = await getDb();
  const stored = (await listUploads()).filter((p) => !p.startsWith("backups/"));
  const zip = await buildBackupZip(db, today(), stored);
  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="ledger-backup_${today()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
