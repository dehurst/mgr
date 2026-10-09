import fs from "node:fs/promises";
import { getDb } from "@/db";
import { getExpense } from "@/lib/expenses";
import { receiptFilename } from "@/lib/receipts";
import { mimeForPath, resolveUpload } from "@/lib/uploads";

// GET /expenses/:id/receipt             -> shown inline (the receipt viewer)
// GET /expenses/:id/receipt?download=1  -> saved as "Receipt <date> <vendor> <amount>.<ext>"
export async function GET(req: Request, ctx: RouteContext<"/expenses/[id]/receipt">) {
  const expense = getExpense(getDb(), Number((await ctx.params).id));
  const abs = expense?.receiptPath ? resolveUpload(expense.receiptPath) : null;
  if (!expense?.receiptPath || !abs) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(abs);
    const download = new URL(req.url).searchParams.has("download");
    const name = receiptFilename({ ...expense, receiptPath: expense.receiptPath });
    return new Response(data, {
      headers: {
        "Content-Type": mimeForPath(abs),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
