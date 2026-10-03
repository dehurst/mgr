import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Alert, Card, CardContent, PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { formatDate, today } from "@/lib/dates";
import { balanceCents, deriveStatus } from "@/lib/invoice-status";
import { getInvoiceDetail } from "@/lib/invoices";
import { formatCents } from "@/lib/money";
import { deletePermanently, duplicate, unvoid, voidIt } from "../actions";
import { PaymentsPanel, SentPanel } from "./payments-panel";

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const id = Number((await params).id);
  const d = getInvoiceDetail(getDb(), id);
  if (!d) notFound();
  const { invoice, client } = d;
  const statusInput = { ...invoice, totalCents: d.totalCents, paidCents: d.paidCents };
  const status = deriveStatus(statusInput, today());
  // Drafts show what will be owed once sent; void shows nothing owed.
  const balance = status === "draft" ? Math.max(0, d.totalCents - d.paidCents) : balanceCents(statusInput);
  const isDraft = status === "draft";
  const hasPayments = d.payments.length > 0;

  return (
    <>
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={
          <span className="flex items-center gap-2">
            <StatusBadge status={status} />
            <Link href={`/clients/${client.id}`} className="hover:underline">
              {client.name}
            </Link>
          </span>
        }
        actions={
          <>
            <a href={`/invoices/${id}/pdf?download=1`} className={buttonVariants()}>
              Download PDF
            </a>
            {!invoice.voidedAt && (
              <Link href={`/invoices/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
                Edit
              </Link>
            )}
            <ActionButton action={duplicate.bind(null, id)}>Duplicate</ActionButton>
            {isDraft ? (
              <ActionButton variant="ghost" confirm={`Delete draft ${invoice.number}? This can't be undone.`} action={deletePermanently.bind(null, id)}>
                Delete draft
              </ActionButton>
            ) : (
              <>
                {invoice.voidedAt ? (
                  <ActionButton variant="ghost" confirm={`Restore ${invoice.number}? It will count in reports again.`} action={unvoid.bind(null, id)}>
                    Un-void
                  </ActionButton>
                ) : (
                  <ActionButton
                    variant="ghost"
                    prompt={`Void ${invoice.number}? It stays on record but is excluded from all totals.\n\nReason (optional):`}
                    action={voidIt.bind(null, id)}
                  >
                    Void
                  </ActionButton>
                )}
                <ActionButton
                  variant="ghost"
                  prompt={`Permanently delete ${invoice.number}${hasPayments ? " and its recorded payments" : ""}? This can't be undone${
                    hasPayments ? ", and that income will disappear from your reports" : ""
                  }.\n\nTip: Void keeps a record instead.\n\nType ${invoice.number} to confirm:`}
                  action={deletePermanently.bind(null, id)}
                >
                  Delete
                </ActionButton>
              </>
            )}
          </>
        }
      />

      {invoice.voidedAt && (
        <Alert className="mb-6">
          Voided on {formatDate(invoice.voidedAt.slice(0, 10))}
          {invoice.voidReason ? `: ${invoice.voidReason}` : ""}. It&apos;s excluded from all totals and reports.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div className="grid content-start gap-6">
          <Card>
            <CardContent className="grid gap-3 text-sm">
              <Row label="Issued" value={formatDate(invoice.issuedOn)} />
              <Row label="Due" value={formatDate(invoice.dueOn)} />
              <hr />
              <Row label="Total" value={formatCents(d.totalCents)} />
              <Row label="Paid" value={formatCents(d.paidCents)} />
              <Row label="Balance due" value={formatCents(balance)} strong />
              {!invoice.voidedAt && (
                <>
                  <hr />
                  <SentPanel
                    invoiceId={id}
                    sentOn={invoice.sentAt?.slice(0, 10) ?? null}
                    today={today()}
                    canUndo={d.paidCents === 0}
                  />
                </>
              )}
            </CardContent>
          </Card>
          <PaymentsPanel
            invoiceId={id}
            payments={d.payments}
            balanceCents={Math.max(0, d.totalCents - d.paidCents)}
            isVoid={!!invoice.voidedAt}
            today={today()}
          />
        </div>
        <Card className="overflow-hidden">
          <iframe
            title={`Invoice ${invoice.number} preview`}
            src={`/invoices/${id}/pdf?v=${encodeURIComponent(invoice.updatedAt)}#view=FitH`}
            className="h-[1000px] w-full border-0"
          />
        </Card>
      </div>
    </>
  );
}


function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
