import { getDb } from "@/db";
import { getExpense } from "@/lib/expenses";
import { receiptFilename } from "@/lib/receipts";
import { readUpload } from "@/lib/uploads";

// GET /expenses/:id/receipt             -> shown inline (the receipt viewer)
// GET /expenses/:id/receipt?download=1  -> saved as "Receipt <date> <vendor> <amount>.<ext>"
export async function GET(req: Request, ctx: RouteContext<"/expenses/[id]/receipt">) {
  const expense = await getExpense(await getDb(), Number((await ctx.params).id));
  const file = expense?.receiptPath ? await readUpload(expense.receiptPath) : null;
  if (!expense?.receiptPath || !file) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  const name = receiptFilename({ ...expense, receiptPath: expense.receiptPath });
  return new Response(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, max-age=0",
    },
  });
}
