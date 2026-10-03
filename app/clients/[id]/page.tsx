import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { InvoiceTable } from "@/components/invoice-table";
import { Stat } from "@/components/stat";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { getClient, totalsFor } from "@/lib/clients";
import { today } from "@/lib/dates";
import { listInvoiceSummaries } from "@/lib/invoices";
import { formatCents } from "@/lib/money";
import { removeClient, setClientArchived } from "../actions";

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const id = Number((await params).id);
  const db = getDb();
  const client = getClient(db, id);
  if (!client) notFound();
  const invoices = listInvoiceSummaries(db, today(), { clientId: id });
  const t = totalsFor(invoices);

  return (
    <>
      <PageHeader
        title={client.name}
        description={client.archivedAt ? <Badge variant="outline">Archived</Badge> : undefined}
        actions={
          <>
            <Link href={`/invoices/new?client=${id}`} className={buttonVariants()}>
              New invoice
            </Link>
            <Link href={`/clients/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              Edit
            </Link>
            <ActionButton action={setClientArchived.bind(null, id, !client.archivedAt)}>
              {client.archivedAt ? "Restore" : "Archive"}
            </ActionButton>
            {invoices.length === 0 && (
              <ActionButton variant="ghost" confirm={`Delete ${client.name}? This can't be undone.`} action={removeClient.bind(null, id)}>
                Delete
              </ActionButton>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total billed" value={formatCents(t.billedCents)} />
        <Stat label="Total paid" value={formatCents(t.paidCents)} />
        <Stat label="Balance due" value={formatCents(t.balanceCents)} />
        <Stat label="Overdue" value={formatCents(t.overdueCents)} tone={t.overdueCents > 0 ? "danger" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length ? (
              <InvoiceTable rows={invoices} showClient={false} />
            ) : (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Detail label="Contact" value={client.contactName} />
            <Detail label="Email" value={client.email} />
            <Detail label="Billing address" value={client.billingAddress} />
            <Detail label="Default rate" value={client.defaultRateCents != null ? `${formatCents(client.defaultRateCents)}/hr` : ""} />
            <Detail label="Notes" value={client.notes} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="whitespace-pre-line">{value || "—"}</div>
    </div>
  );
}
