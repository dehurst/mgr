// Personal spending: everything in a personal category, plus the personal share of mixed-use
// expenses (e.g. 60% of a phone bill at 40% business). Same split as every other report
// (splitExpense), so the total here equals the "personal" figure on the P&L and expense report.
import { sumCents } from "@/lib/money";
import { isPersonal, splitExpense, type ExpenseRow } from "./data";
import { totalsByVendor, type VendorTotal } from "./expenses";

export type PersonalSource = {
  categoryId: number;
  name: string;
  /** True for the personal category; false for the personal share of a mixed-use category. */
  fullyPersonal: boolean;
  cents: number;
  count: number;
};

export type PersonalItem = ExpenseRow & { personalCents: number };

export function personalSpending(rows: ExpenseRow[]) {
  const items: PersonalItem[] = rows
    .map((r) => ({ ...r, personalCents: splitExpense(r).personalCents }))
    .filter((r) => r.personalCents !== 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

  const sources = new Map<number, PersonalSource>();
  for (const r of items) {
    const s = sources.get(r.categoryId) ?? { categoryId: r.categoryId, name: r.categoryName, fullyPersonal: isPersonal(r), cents: 0, count: 0 };
    s.cents += r.personalCents;
    s.count++;
    sources.set(r.categoryId, s);
  }

  const months = new Map<string, number>();
  for (const r of items) months.set(r.date.slice(0, 7), (months.get(r.date.slice(0, 7)) ?? 0) + r.personalCents);

  const byVendor: VendorTotal[] = totalsByVendor(items, (r) => (r as PersonalItem).personalCents);
  return {
    items,
    bySource: [...sources.values()].sort((a, b) => Number(b.fullyPersonal) - Number(a.fullyPersonal) || b.cents - a.cents),
    byVendor,
    /** "YYYY-MM" → cents, oldest first; only months with personal spending. */
    byMonth: [...months].sort((a, b) => a[0].localeCompare(b[0])).map(([month, cents]) => ({ month, cents })),
    totalCents: sumCents(items.map((r) => r.personalCents)),
  };
}
