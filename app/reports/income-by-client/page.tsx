import Link from "next/link";
import { RangeFilter } from "@/components/range-filter";
import { ReportHeader } from "@/components/report-header";
import { Card, CardContent } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate, today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { rangeQuery, resolveRange } from "@/lib/range";
import { incomeByClientReport } from "@/lib/reports";
import { getSettings } from "@/lib/settings";

export default async function IncomeByClientPage({ searchParams }: PageProps<"/reports/income-by-client">) {
  const range = resolveRange(await searchParams, today(), "ytd");
  const r = incomeByClientReport(getDb(), range);
  return (
    <>
      <ReportHeader
        title="Income by client"
        period={`${formatDate(range.from)} – ${formatDate(range.to)} · money received (cash basis)`}
        businessName={getSettings().businessName}
        csvHref={`/reports/csv?report=income-by-client&${rangeQuery(range)}`}
      />
      <Card>
        <CardContent className="grid gap-4">
          <RangeFilter range={range} />
          {r.clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No income received in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Invoice payments</TableHead>
                  <TableHead className="text-right">Other income</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-20 text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.clients.map((c) => (
                  <TableRow key={c.clientId ?? "none"}>
                    <TableCell>
                      {c.clientId ? (
                        <Link href={`/clients/${c.clientId}`} className="font-medium hover:underline">
                          {c.clientName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{c.clientName}</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatCents(c.invoicePaymentsCents)}</TableCell>
                    <TableCell className="tabular text-right">{formatCents(c.otherIncomeCents)}</TableCell>
                    <TableCell className="tabular text-right font-medium">{formatCents(c.totalCents)}</TableCell>
                    <TableCell className="tabular text-right text-xs text-muted-foreground">
                      {r.totalCents ? `${Math.round((c.totalCents / r.totalCents) * 100)}%` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="tabular text-right">{formatCents(r.totalCents)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
