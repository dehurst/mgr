import { asc, eq, isNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { categoryOptions, getExpense, recentVendors } from "@/lib/expenses";
import { formatCents } from "@/lib/money";
import { deleteExpense } from "../actions";
import { ExpenseForm } from "../expense-form";

export default async function EditExpensePage({ params }: PageProps<"/expenses/[id]">) {
  const id = Number((await params).id);
  const db = getDb();
  const expense = getExpense(db, id);
  if (!expense) notFound();
  const clientOptions = db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(expense.clientId ? or(isNull(clients.archivedAt), eq(clients.id, expense.clientId)) : isNull(clients.archivedAt))
    .orderBy(asc(clients.name))
    .all();

  return (
    <>
      <PageHeader
        title={`${expense.vendor} · ${formatCents(expense.amountCents)}`}
        actions={
          <ActionButton
            variant="ghost"
            confirm={`Delete this ${formatCents(expense.amountCents)} expense from ${expense.vendor}${expense.receiptPath ? " and its receipt" : ""}? This can't be undone.`}
            action={deleteExpense.bind(null, id)}
          >
            Delete
          </ActionButton>
        }
      />
      <ExpenseForm
        expense={expense}
        categories={categoryOptions(db, expense.categoryId)}
        clients={clientOptions}
        vendors={recentVendors(db)}
        defaults={{ paidOn: expense.paidOn, paymentMethod: expense.paymentMethod }}
      />
    </>
  );
}
