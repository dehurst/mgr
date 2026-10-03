import { getDb } from "@/db";
import { getInvoiceDetail } from "@/lib/invoices";
import { invoicePdfFilename, renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { getSettings } from "@/lib/settings";
import { resolveUpload } from "@/lib/uploads";

// GET /invoices/:id/pdf            -> shown inline (used by the preview)
// GET /invoices/:id/pdf?download=1 -> saved as a file
export async function GET(req: Request, ctx: RouteContext<"/invoices/[id]/pdf">) {
  const id = Number((await ctx.params).id);
  const detail = getInvoiceDetail(getDb(), id);
  if (!detail) return new Response("Not found", { status: 404 });
  const settings = getSettings();
  const pdf = await renderInvoicePdf({
    detail,
    settings,
    logoAbsPath: settings.logoPath ? resolveUpload(settings.logoPath) : null,
  });
  const filename = invoicePdfFilename(detail.invoice.number, settings.businessName);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
