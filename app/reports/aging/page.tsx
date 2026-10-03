import Link from "next/link";
import { ReportHeader } from "@/components/report-header";
import { Stat } from "@/components/stat";
import { Card, CardContent } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate, today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { agingReport } from "@/lib/reports";
import { AGING_BUCKETS, AGING_LABELS } from "@/lib/reports/aging";
import { getSettings } from "@/lib/settings";

export default function AgingPage() {
  const asOf = today();
  const r = agingReport(getDb(), asOf);
  return (
    <>
      <ReportHeader
        title="Accounts receivable aging"
        period={`Open invoices as of ${formatDate(asOf)} · days past the due date`}
        businessName={getSettings().businessName}
        csvHref="/reports/csv?report=aging"
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {AGING_BUCKETS.map((b) => (
          <Stat key={b} label={AGING_LABELS[b]} value={formatCents(r.buckets[b])} tone={b !== "current" && r.buckets[b] > 0 ? "danger" : undefined} />
        ))}
        <Stat label="Total owed" value={formatCents(r.totalCents)} />
      </div>
      <Card>
        <CardContent>
          {r.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody owes you anything right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Days past due</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.rows.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      <Link href={`/invoices/${x.id}`} className="font-medium hover:underline">
                        {x.number}
                      </Link>
                    </TableCell>
                    <TableCell>{x.clientName}</TableCell>
                    <TableCell>{formatDate(x.dueOn)}</TableCell>
                    <TableCell className="tabular text-right">{x.daysPastDue}</TableCell>
                    <TableCell className={x.bucket === "current" ? "" : "text-destructive"}>{AGING_LABELS[x.bucket]}</TableCell>
                    <TableCell className="tabular text-right">{formatCents(x.balanceCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="tabular text-right">{formatCents(r.totalCents)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
