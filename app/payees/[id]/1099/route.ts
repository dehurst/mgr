import { getDb } from "@/db";
import { today } from "@/lib/dates";
import { form1099Filename, render1099Pdf } from "@/lib/pdf/form-1099-pdf";
import { getPayee } from "@/lib/payees";
import { form1099Report } from "@/lib/reports";
import { getSettings } from "@/lib/settings";

// GET /payees/:id/1099?year=2026[&download=1] -> the recipient's copy (Copy B) for that year.
export async function GET(req: Request, ctx: RouteContext<"/payees/[id]/1099">) {
  const id = Number((await ctx.params).id);
  const sp = new URL(req.url).searchParams;
  const year = Number(sp.get("year")) || Number(today().slice(0, 4)) - 1;
  const db = getDb();
  const payee = getPayee(db, id);
  if (!payee) return new Response("Not found", { status: 404 });
  const row = form1099Report(db, year).rows.find((r) => r.payee.id === id);
  if (!row || row.reportableCents === 0) return new Response(`No reportable payments to ${payee.name} in ${year}.`, { status: 404 });
  const pdf = await render1099Pdf({ year, payee, amountCents: row.reportableCents, settings: getSettings() });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${sp.has("download") ? "attachment" : "inline"}; filename="${form1099Filename(year, payee.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
