import { asc } from "drizzle-orm";
import Link from "next/link";
import { InvoiceTable } from "@/components/invoice-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { Card, CardContent, PageHeader } from "@/components/ui/misc";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { isValidDate, today } from "@/lib/dates";
import { INVOICE_STATUSES, STATUS_LABELS, type InvoiceStatus } from "@/lib/invoice-status";
import { listInvoiceSummaries } from "@/lib/invoices";
import { formatCents, sumCents } from "@/lib/money";
import { cn } from "@/lib/utils";

// "Open" = sent, partially paid, or overdue: anything with a balance.
const OPEN: InvoiceStatus[] = ["sent", "partially_paid", "overdue"];

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const status = one("status");
  const clientId = Number(one("client")) || undefined;
  const from = isValidDate(one("from")) ? one("from") : "";
  const to = isValidDate(one("to")) ? one("to") : "";

  const db = getDb();
  const clientOptions = db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)).all();
  const base = listInvoiceSummaries(db, today(), { clientId }).filter(
    (r) => (!from || r.issuedOn >= from) && (!to || r.issuedOn <= to),
  );
  const rows = base.filter((r) => !status || (status === "open" ? OPEN.includes(r.status) : r.status === status));

  const sum = (pred: (s: InvoiceStatus) => boolean, field: "totalCents" | "balanceCents") =>
    sumCents(base.filter((r) => pred(r.status)).map((r) => r[field]));
  const cards = [
    { key: "draft", label: "Drafts", value: sum((s) => s === "draft", "totalCents") },
    { key: "open", label: "Outstanding", value: sum((s) => OPEN.includes(s), "balanceCents") },
    { key: "overdue", label: "Overdue", value: sum((s) => s === "overdue", "balanceCents"), danger: true },
    { key: "paid", label: "Paid", value: sum((s) => s === "paid", "totalCents") },
  ];

  const linkWith = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ ...(clientId ? { client: String(clientId) } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...patch });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    const s = q.toString();
    return s ? `/invoices?${s}` : "/invoices";
  };

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          <Link href="/invoices/new" className={buttonVariants()}>
            New invoice
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.key} href={linkWith({ status: status === c.key ? "" : c.key })}>
            <Card className={cn("transition-colors hover:bg-muted/50", status === c.key && "ring-2 ring-ring")}>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className={cn("tabular mt-1 text-xl font-semibold", c.danger && c.value > 0 && "text-destructive")}>
                  {formatCents(c.value)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-4">
          <form className="no-print flex flex-wrap items-end gap-3" method="get">
            <div className="grid gap-1">
              <Label htmlFor="f-status">Status</Label>
              <Select id="f-status" name="status" defaultValue={status} className="w-40">
                <option value="">All</option>
                <option value="open">Outstanding</option>
                {INVOICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="f-client">Client</Label>
              <Select id="f-client" name="client" defaultValue={clientId ? String(clientId) : ""} className="w-52">
                <option value="">All clients</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="f-from">Issued from</Label>
              <Input id="f-from" name="from" type="date" defaultValue={from} className="w-40" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="f-to">to</Label>
              <Input id="f-to" name="to" type="date" defaultValue={to} className="w-40" />
            </div>
            <Button type="submit" variant="outline">
              Filter
            </Button>
            {(status || clientId || from || to) && (
              <Link href="/invoices" className={buttonVariants({ variant: "ghost" })}>
                Clear
              </Link>
            )}
          </form>

          {rows.length ? (
            <InvoiceTable rows={rows} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {status || clientId || from || to ? "No invoices match these filters." : "No invoices yet."}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
