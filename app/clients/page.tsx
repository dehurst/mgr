import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { listClientsWithTotals } from "@/lib/clients";
import { today } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const showArchived = (await searchParams).archived === "1";
  const all = listClientsWithTotals(getDb(), today());
  const rows = all.filter((c) => showArchived || !c.archivedAt);
  const archivedCount = all.filter((c) => c.archivedAt).length;

  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <Link href="/clients/new" className={buttonVariants()}>
            New client
          </Link>
        }
      />
      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clients yet. <Link href="/clients/new" className="underline">Add your first client</Link>.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.archivedAt && <span className="ml-2 text-xs text-muted-foreground">(archived)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.contactName || c.email}</TableCell>
                    <TableCell className="tabular text-right">{formatCents(c.totals.billedCents)}</TableCell>
                    <TableCell className="tabular text-right">{formatCents(c.totals.paidCents)}</TableCell>
                    <TableCell className={`tabular text-right ${c.totals.overdueCents > 0 ? "font-medium text-destructive" : ""}`}>
                      {formatCents(c.totals.balanceCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {archivedCount > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              <Link href={showArchived ? "/clients" : "/clients?archived=1"} className="underline">
                {showArchived ? "Hide" : "Show"} {archivedCount} archived
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
