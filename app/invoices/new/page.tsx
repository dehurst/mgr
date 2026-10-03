import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { addDays, today } from "@/lib/dates";
import { suggestInvoiceNumber } from "@/lib/invoices";
import { centsToInput } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { InvoiceForm } from "../invoice-form";

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoices/new">) {
  const db = getDb();
  const settings = getSettings();
  const options = db
    .select({ id: clients.id, name: clients.name, defaultRateCents: clients.defaultRateCents })
    .from(clients)
    .where(isNull(clients.archivedAt))
    .orderBy(asc(clients.name))
    .all();

  if (options.length === 0) {
    return (
      <>
        <PageHeader title="New invoice" />
        <Card>
          <CardContent className="grid gap-3 text-sm">
            <p>Add a client first, then come back to invoice them.</p>
            <div>
              <Link href="/clients/new" className={buttonVariants()}>
                New client
              </Link>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  const requested = String((await searchParams).client ?? "");
  const preselected = options.find((c) => String(c.id) === requested);
  const issuedOn = today();
  return (
    <>
      <PageHeader title="New invoice" />
      <InvoiceForm
        invoiceId={null}
        clients={options}
        defaultTermsDays={settings.defaultTermsDays}
        initial={{
          clientId: preselected ? String(preselected.id) : "",
          number: suggestInvoiceNumber(db),
          issuedOn,
          dueOn: addDays(issuedOn, settings.defaultTermsDays),
          notes: "",
          lines: [
            {
              description: "",
              hours: "",
              rate: preselected?.defaultRateCents != null ? centsToInput(preselected.defaultRateCents) : "",
            },
          ],
        }}
      />
    </>
  );
}
