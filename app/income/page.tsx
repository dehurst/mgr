import { asc } from "drizzle-orm";
import Link from "next/link";
import { RangeFilter } from "@/components/range-filter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { formatDate, today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { listOtherIncome } from "@/lib/other-income";
import { resolveRange } from "@/lib/range";
import { IncomeForm } from "./income-form";

export default async function OtherIncomePage({ searchParams }: PageProps<"/income">) {
  const range = resolveRange(await searchParams, today());
  const db = getDb();
  const { rows, totalCents } = listOtherIncome(db, range);
  const clientOptions = db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)).all();

  return (
    <>
      <PageHeader
        title="Other income"
        description="Money received that isn't a payment on an invoice in this app. It counts as income on the date received."
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add income</CardTitle>
            <CardDescription>
              Catching up on 2026? Add what QuickBooks received from January to September, one entry per client per month, with the
              client selected, so income by client stays accurate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeForm clients={clientOptions} today={today()} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4">
            <RangeFilter range={range} />
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other income in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(r.receivedOn)}</TableCell>
                      <TableCell>
                        <Link href={`/income/${r.id}`} className="font-medium hover:underline">
                          {r.source}
                        </Link>
                        {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.clientName ?? "—"}</TableCell>
                      <TableCell className="tabular text-right">{formatCents(r.amountCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="tabular text-right">{formatCents(totalCents)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
