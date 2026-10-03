import { asc, isNull } from "drizzle-orm";
import { Alert, PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { clients, EXPENSE_PAYMENT_METHODS } from "@/db/schema";
import { isValidDate, today } from "@/lib/dates";
import { categoryOptions, recentVendors } from "@/lib/expenses";
import { ExpenseForm } from "../expense-form";

export default async function NewExpensePage({ searchParams }: PageProps<"/expenses/new">) {
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : "";
  const date = typeof sp.date === "string" && isValidDate(sp.date) ? sp.date : today();
  const method =
    typeof sp.method === "string" && (EXPENSE_PAYMENT_METHODS as readonly string[]).includes(sp.method) ? sp.method : "business_card";
  const db = getDb();
  return (
    <>
      <PageHeader title="New expense" />
      {saved && (
        <Alert variant="success" className="mb-6">
          Saved {saved}. Add the next one.
        </Alert>
      )}
      <ExpenseForm
        // A fresh key after each save resets the form fields.
        key={saved}
        categories={categoryOptions(db)}
        clients={db.select({ id: clients.id, name: clients.name }).from(clients).where(isNull(clients.archivedAt)).orderBy(asc(clients.name)).all()}
        vendors={recentVendors(db)}
        defaults={{ paidOn: date, paymentMethod: method }}
      />
    </>
  );
}
