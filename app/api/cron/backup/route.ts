import { getDbForSystemJob } from "@/db";
import { backupsToPrune, buildBackupZip, cronAuthorized } from "@/lib/backup";
import { today } from "@/lib/dates";
import { deleteUpload, listUploads, writeUpload } from "@/lib/uploads";

// Daily (vercel.json): saves backups/ledger-<date>.zip to private storage and keeps the newest 30.
// Reading the whole database every day also keeps Turso's free tier from archiving it as idle.
export async function GET(req: Request) {
  if (!cronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const stored = await listUploads();
  const zip = await buildBackupZip(await getDbForSystemJob(), today(), stored.filter((p) => !p.startsWith("backups/")));
  const name = `backups/ledger-${today()}.zip`;
  await writeUpload(name, zip, "application/zip");
  const pruned = backupsToPrune([...stored, name]);
  for (const p of pruned) await deleteUpload(p);
  return Response.json({ ok: true, saved: name, bytes: zip.length, pruned: pruned.length });
}
