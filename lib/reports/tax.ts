import { SCHEDULE_C_LINES } from "@/lib/schedule-c";
import { sumCents } from "@/lib/money";
import { isPersonal, type ExpenseRow, type IncomeRow } from "./data";
import { expensesByCategory, type CategoryTotal } from "./expenses";

export type TaxLine = {
  line: string;
  label: string;
  /** The amount for the form line (after the 50% limit on line 24b). */
  cents: number;
  /** What was actually spent; differs from `cents` only on line 24b. */
  recordedCents: number;
  categories: CategoryTotal[];
};

export const MEALS_LINE = "24b";

/** Half of a cent amount, rounded half up (for the 50% meals limit). */
export function halfCents(cents: number): number {
  return Math.floor((cents + 1) / 2);
}

/**
 * Expenses rolled up by Schedule C line, in form order. Lines with no expenses are omitted.
 * Gross receipts = all money received. Line 24b carries the deductible 50% of meals, as the form
 * asks; everything else is the amount spent. The CPA makes final calls (depreciation, etc.).
 */
export function taxSummary(income: IncomeRow[], expenses: ExpenseRow[]) {
  const byCat = expensesByCategory(expenses.filter((r) => !isPersonal(r)));
  const order = SCHEDULE_C_LINES.map((l) => l.line as string);
  const lines: TaxLine[] = [];
  for (const def of SCHEDULE_C_LINES) {
    const cats = byCat.filter((c) => c.scheduleCLine === def.line);
    if (!cats.length) continue;
    const recordedCents = sumCents(cats.map((c) => c.cents));
    const cents = def.line === MEALS_LINE ? halfCents(recordedCents) : recordedCents;
    lines.push({ line: def.line, label: def.label, cents, recordedCents, categories: cats });
  }
  // Categories mapped to a line no longer in the list still count; put them under "Other".
  const unknown = byCat.filter((c) => !order.includes(c.scheduleCLine));
  if (unknown.length) {
    const other = lines.find((l) => l.line === "27a");
    if (other) {
      const add = sumCents(unknown.map((c) => c.cents));
      other.categories.push(...unknown);
      other.cents += add;
      other.recordedCents += add;
    } else {
      const cents = sumCents(unknown.map((c) => c.cents));
      lines.push({ line: "27a", label: "Other expenses", cents, recordedCents: cents, categories: unknown });
    }
  }

  const grossReceiptsCents = sumCents(income.map((r) => r.amountCents));
  const totalExpensesCents = sumCents(lines.map((l) => l.cents));
  const meals = lines.find((l) => l.line === MEALS_LINE);
  return {
    grossReceiptsCents,
    lines,
    totalExpensesCents,
    /** Meals as spent, and the deductible half used on line 24b. */
    mealsCents: meals?.recordedCents ?? 0,
    mealsDeductibleCents: meals?.cents ?? 0,
    netCents: grossReceiptsCents - totalExpensesCents,
  };
}
