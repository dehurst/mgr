import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { expenseCategories } from "@/db/schema";
import { csvResponse } from "@/lib/csv";
import { formatDate, today } from "@/lib/dates";
import { expenseListCsv, listExpenses } from "@/lib/expenses";
import { resolveRange } from "@/lib/range";

// GET /expenses/csv?range=…|from=…&to=…[&category=ID] -> the Expenses page, as filtered, as CSV.
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const db = await getDb();
  const range = resolveRange(sp, today());
  const categoryId = Number(sp.category) || undefined;
  const category = categoryId
    ? (await db.select({ name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.id, categoryId)).get())?.name
    : undefined;
  const list = await listExpenses(db, { range, categoryId });
  const title = `Expenses, ${formatDate(range.from)} – ${formatDate(range.to)}${category ? ` · ${category}` : ""}`;
  const slug = category ? `_${category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "";
  return csvResponse(`expenses_${range.from}_to_${range.to}${slug}.csv`, expenseListCsv(list, title));
}
