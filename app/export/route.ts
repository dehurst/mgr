import { getDb } from "@/db";
import { today } from "@/lib/dates";
import { exportZip } from "@/lib/export";

// GET /export -> every table as CSV, in one zip.
export function GET() {
  const zip = exportZip(getDb(), today());
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="ledger-export_${today()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
