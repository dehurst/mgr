import Link from "next/link";
import { Form1099Badge } from "@/components/form-1099-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate, today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { listPayeesWithTotals } from "@/lib/payees";

export default async function PayeesPage({ searchParams }: PageProps<"/payees">) {
  const showArchived = (await searchParams).archived === "1";
  const year = Number(today().slice(0, 4));
  const all = listPayeesWithTotals(getDb(), year);
  const rows = all.filter((r) => showArchived || !r.payee.archivedAt);
  const archivedCount = all.filter((r) => r.payee.archivedAt).length;

  return (
    <>
      <PageHeader
        title="Payees"
        description="People you pay for work (1099 contractors). Payments to them are expenses, so they're already in your reports."
        actions={
          <>
            <Link href={`/reports/1099?year=${year}`} className={buttonVariants({ variant: "outline" })}>
              1099 summary
            </Link>
            <Link href="/payees/new" className={buttonVariants()}>
              New payee
            </Link>
          </>
        }
      />
      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payees yet. <Link href="/payees/new" className="underline">Add someone you pay for work</Link>.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>W-9</TableHead>
                  <TableHead className="text-right">Counts toward 1099, {year}</TableHead>
                  <TableHead>{year} 1099-NEC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ payee: p, year: y }) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/payees/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      {p.businessName && <span className="ml-2 text-muted-foreground">{p.businessName}</span>}
                      {p.archivedAt && <span className="ml-2 text-xs text-muted-foreground">(archived)</span>}
                    </TableCell>
                    <TableCell className={p.w9ReceivedOn ? "text-muted-foreground" : "text-destructive"}>
                      {p.w9ReceivedOn ? formatDate(p.w9ReceivedOn) : "Not on file"}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatCents(y?.reportableCents ?? 0)}</TableCell>
                    <TableCell>{y && y.status !== "none" ? <Form1099Badge row={y} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {archivedCount > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              <Link href={showArchived ? "/payees" : "/payees?archived=1"} className="underline">
                {showArchived ? "Hide" : "Show"} {archivedCount} archived
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
