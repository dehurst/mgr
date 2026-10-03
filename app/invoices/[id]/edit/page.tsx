import { asc, eq, isNull, or } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { getInvoiceDetail } from "@/lib/invoices";
import { centsToInput, formatQuantity } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { InvoiceForm } from "../../invoice-form";

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const id = Number((await params).id);
  const db = getDb();
  const d = getInvoiceDetail(db, id);
  if (!d) notFound();
  if (d.invoice.voidedAt) redirect(`/invoices/${id}`);
  const options = db
    .select({ id: clients.id, name: clients.name, defaultRateCents: clients.defaultRateCents })
    .from(clients)
    .where(or(isNull(clients.archivedAt), eq(clients.id, d.invoice.clientId)))
    .orderBy(asc(clients.name))
    .all();

  return (
    <>
      <PageHeader
        title={`Edit ${d.invoice.number}`}
        description={d.invoice.sentAt ? "This invoice was already sent. If you change it, send the client the updated copy." : undefined}
      />
      <InvoiceForm
        invoiceId={id}
        clients={options}
        defaultTermsDays={getSettings().defaultTermsDays}
        initial={{
          clientId: String(d.invoice.clientId),
          number: d.invoice.number,
          issuedOn: d.invoice.issuedOn,
          dueOn: d.invoice.dueOn,
          notes: d.invoice.notes,
          lines: d.lines.map((l) => ({
            description: l.description,
            hours: formatQuantity(l.quantityMilli),
            rate: centsToInput(l.unitPriceCents),
          })),
        }}
      />
    </>
  );
}
