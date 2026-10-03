import { sumCents } from "@/lib/money";
import { isPersonal, type ExpenseRow } from "./data";

export type CategoryTotal = { categoryId: number; name: string; scheduleCLine: string; cents: number; count: number };
export type VendorTotal = { vendor: string; cents: number; count: number };

/** Sorted by amount, largest first; ties by name. */
export function expensesByCategory(rows: ExpenseRow[]): CategoryTotal[] {
  const map = new Map<number, CategoryTotal>();
  for (const r of rows) {
    const t = map.get(r.categoryId) ?? { categoryId: r.categoryId, name: r.categoryName, scheduleCLine: r.scheduleCLine, cents: 0, count: 0 };
    t.cents += r.amountCents;
    t.count++;
    map.set(r.categoryId, t);
  }
  return [...map.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
}

/** Vendors are grouped case-insensitively; the most common spelling is shown. */
export function expensesByVendor(rows: ExpenseRow[]): VendorTotal[] {
  const map = new Map<string, VendorTotal & { spellings: Map<string, number> }>();
  for (const r of rows) {
    const key = r.vendor.trim().toLowerCase();
    const t = map.get(key) ?? { vendor: r.vendor.trim(), cents: 0, count: 0, spellings: new Map() };
    t.cents += r.amountCents;
    t.count++;
    t.spellings.set(r.vendor.trim(), (t.spellings.get(r.vendor.trim()) ?? 0) + 1);
    map.set(key, t);
  }
  return [...map.values()]
    .map(({ spellings, ...t }) => ({ ...t, vendor: [...spellings].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.cents - a.cents || a.vendor.localeCompare(b.vendor));
}

/** Business expenses only; personal spending is reported separately. */
export function expenseReport(rows: ExpenseRow[]) {
  const business = rows.filter((r) => !isPersonal(r));
  const personal = rows.filter(isPersonal);
  return {
    business,
    personal,
    byCategory: expensesByCategory(business),
    byVendor: expensesByVendor(business),
    totalCents: sumCents(business.map((r) => r.amountCents)),
    count: business.length,
    personalCents: sumCents(personal.map((r) => r.amountCents)),
  };
}

export type MonthTotal = { month: number; businessCents: number; personalCents: number };

/** Business and personal totals for each month (1–12) of `year`. Rows outside the year are ignored. */
export function expensesByMonth(rows: ExpenseRow[], year: number): MonthTotal[] {
  const months: MonthTotal[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, businessCents: 0, personalCents: 0 }));
  const prefix = `${String(year).padStart(4, "0")}-`;
  for (const r of rows) {
    if (!r.date.startsWith(prefix)) continue;
    const m = months[Number(r.date.slice(5, 7)) - 1];
    if (isPersonal(r)) m.personalCents += r.amountCents;
    else m.businessCents += r.amountCents;
  }
  return months;
}

/**
 * Clean axis ticks (in cents) from 0 to at least `maxCents`: about four steps of
 * 1, 2, 2.5, or 5 × a power of ten dollars.
 */
export function axisTicks(maxCents: number, steps = 4): number[] {
  if (maxCents <= 0) return [0, 100_00];
  const rough = maxCents / 100 / steps;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= rough) ?? 10) * pow;
  const stepCents = Math.round(step * 100);
  const ticks = [0];
  while (ticks[ticks.length - 1] < maxCents) ticks.push(ticks[ticks.length - 1] + stepCents);
  return ticks;
}
