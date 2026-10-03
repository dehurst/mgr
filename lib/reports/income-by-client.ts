import { sumCents } from "@/lib/money";
import type { IncomeRow } from "./data";

export type ClientIncome = {
  clientId: number | null;
  clientName: string;
  invoicePaymentsCents: number;
  otherIncomeCents: number;
  totalCents: number;
};

export const NO_CLIENT = "No client";

/** Money received per client (cash basis). Other income without a client is grouped last. */
export function incomeByClient(rows: IncomeRow[]) {
  const map = new Map<number | null, ClientIncome>();
  for (const r of rows) {
    const key = r.clientId;
    const t = map.get(key) ?? {
      clientId: key,
      clientName: r.clientName ?? NO_CLIENT,
      invoicePaymentsCents: 0,
      otherIncomeCents: 0,
      totalCents: 0,
    };
    if (r.kind === "payment") t.invoicePaymentsCents += r.amountCents;
    else t.otherIncomeCents += r.amountCents;
    t.totalCents += r.amountCents;
    map.set(key, t);
  }
  const clients = [...map.values()].sort((a, b) => {
    if ((a.clientId === null) !== (b.clientId === null)) return a.clientId === null ? 1 : -1;
    return b.totalCents - a.totalCents || a.clientName.localeCompare(b.clientName);
  });
  return { clients, totalCents: sumCents(clients.map((c) => c.totalCents)) };
}
