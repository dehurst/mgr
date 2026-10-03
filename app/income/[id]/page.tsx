import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { Card, CardContent, PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { formatDate, today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { getOtherIncome } from "@/lib/other-income";
import { deleteOtherIncome } from "../actions";
import { IncomeForm } from "../income-form";

export default async function EditIncomePage({ params }: PageProps<"/income/[id]">) {
  const id = Number((await params).id);
  const db = getDb();
  const entry = getOtherIncome(db, id);
  if (!entry) notFound();
  return (
    <>
      <PageHeader
        title={`Edit income · ${formatCents(entry.amountCents)}`}
        actions={
          <ActionButton
            variant="ghost"
            confirm={`Delete ${formatCents(entry.amountCents)} received ${formatDate(entry.receivedOn)}? This can't be undone.`}
            action={deleteOtherIncome.bind(null, id)}
          >
            Delete
          </ActionButton>
        }
      />
      <Card>
        <CardContent>
          <IncomeForm entry={entry} clients={db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)).all()} today={today()} />
        </CardContent>
      </Card>
    </>
  );
}
