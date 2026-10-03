import { sumCents } from "@/lib/money";
import type { ExpenseRow } from "./data";

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

export function expenseReport(rows: ExpenseRow[]) {
  return {
    byCategory: expensesByCategory(rows),
    byVendor: expensesByVendor(rows),
    totalCents: sumCents(rows.map((r) => r.amountCents)),
    count: rows.length,
  };
}
