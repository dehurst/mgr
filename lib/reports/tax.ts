import { SCHEDULE_C_LINES } from "@/lib/schedule-c";
import { sumCents } from "@/lib/money";
import { isPersonal, type ExpenseRow, type IncomeRow } from "./data";
import { expensesByCategory, type CategoryTotal } from "./expenses";

export type TaxLine = {
  line: string;
  label: string;
  cents: number;
  categories: CategoryTotal[];
};

/** Half of a cent amount, rounded half up (for the 50% meals limit). */
export function halfCents(cents: number): number {
  return Math.floor((cents + 1) / 2);
}

/**
 * Expenses rolled up by Schedule C line, in form order. Lines with no expenses are omitted.
 * Gross receipts = all money received. The CPA makes final calls (meals limit, depreciation, etc.).
 */
export function taxSummary(income: IncomeRow[], expenses: ExpenseRow[]) {
  const byCat = expensesByCategory(expenses.filter((r) => !isPersonal(r)));
  const order = SCHEDULE_C_LINES.map((l) => l.line as string);
  const lines: TaxLine[] = [];
  for (const def of SCHEDULE_C_LINES) {
    const cats = byCat.filter((c) => c.scheduleCLine === def.line);
    if (cats.length) lines.push({ line: def.line, label: def.label, cents: sumCents(cats.map((c) => c.cents)), categories: cats });
  }
  // Categories mapped to a line no longer in the list still count; put them under "Other".
  const unknown = byCat.filter((c) => !order.includes(c.scheduleCLine));
  if (unknown.length) {
    const other = lines.find((l) => l.line === "27a");
    if (other) {
      other.categories.push(...unknown);
      other.cents += sumCents(unknown.map((c) => c.cents));
    } else {
      lines.push({ line: "27a", label: "Other expenses", cents: sumCents(unknown.map((c) => c.cents)), categories: unknown });
    }
  }

  const grossReceiptsCents = sumCents(income.map((r) => r.amountCents));
  const totalExpensesCents = sumCents(lines.map((l) => l.cents));
  const mealsCents = lines.find((l) => l.line === "24b")?.cents ?? 0;
  return {
    grossReceiptsCents,
    lines,
    totalExpensesCents,
    mealsCents,
    mealsDeductibleCents: halfCents(mealsCents),
    netCents: grossReceiptsCents - totalExpensesCents,
  };
}
