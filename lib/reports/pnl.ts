import { sumCents } from "@/lib/money";
import { isPersonal, type ExpenseRow, type IncomeRow } from "./data";
import { expensesByCategory, type CategoryTotal } from "./expenses";

export type Pnl = {
  invoicePaymentsCents: number;
  otherIncomeCents: number;
  incomeCents: number;
  expensesByCategory: CategoryTotal[];
  expensesCents: number;
  netCents: number;
  /** Personal spending in the rows, excluded from expenses and net. */
  personalCents: number;
};

/** Cash-basis profit and loss: money received minus money spent, in the rows given. */
export function computePnl(income: IncomeRow[], expenses: ExpenseRow[]): Pnl {
  const invoicePaymentsCents = sumCents(income.filter((r) => r.kind === "payment").map((r) => r.amountCents));
  const otherIncomeCents = sumCents(income.filter((r) => r.kind === "other").map((r) => r.amountCents));
  const byCat = expensesByCategory(expenses.filter((r) => !isPersonal(r)));
  const expensesCents = sumCents(byCat.map((c) => c.cents));
  const incomeCents = invoicePaymentsCents + otherIncomeCents;
  return {
    invoicePaymentsCents,
    otherIncomeCents,
    incomeCents,
    expensesByCategory: byCat,
    expensesCents,
    netCents: incomeCents - expensesCents,
    personalCents: sumCents(expenses.filter(isPersonal).map((r) => r.amountCents)),
  };
}
