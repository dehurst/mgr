import Link from "next/link";
import { RangeFilter } from "@/components/range-filter";
import { ReportHeader } from "@/components/report-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate, today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { rangeQuery, resolveRange } from "@/lib/range";
import { expensesReportData } from "@/lib/reports";
import { getSettings } from "@/lib/settings";

export default async function ExpenseReportPage({ searchParams }: PageProps<"/reports/expenses">) {
  const sp = await searchParams;
  const range = resolveRange(sp, today(), "ytd");
  const r = expensesReportData(getDb(), range);
  const categoryId = Number(sp.category) || null;
  const vendor = typeof sp.vendor === "string" ? sp.vendor : "";
  const base = `/reports/expenses?${rangeQuery(range)}`;

  // Drill-down: transactions for one category or vendor (case-insensitive, like the grouping).
  const drill = categoryId
    ? { label: r.rows.find((e) => e.categoryId === categoryId)?.categoryName ?? "Category", rows: r.rows.filter((e) => e.categoryId === categoryId) }
    : vendor
      ? { label: vendor, rows: r.business.filter((e) => e.vendor.trim().toLowerCase() === vendor.trim().toLowerCase()) }
      : null;
  const txRows = drill ? drill.rows : r.business;
  const personalCategoryId = r.personal[0]?.categoryId;
  const txTotal = txRows.reduce((s, e) => s + e.amountCents, 0);

  return (
    <>
      <ReportHeader
        title="Expense report"
        period={`${formatDate(range.from)} – ${formatDate(range.to)} · ${r.count} expense${r.count === 1 ? "" : "s"} · ${formatCents(r.totalCents)}`}
        businessName={getSettings().businessName}
        csvHref={`/reports/csv?report=expenses&${rangeQuery(range)}`}
      />
      <div className="grid gap-6">
        <Card className="no-print">
          <CardContent>
            <RangeFilter range={range} />
          </CardContent>
        </Card>

        {r.personalCents > 0 && (
          <p className="text-sm text-muted-foreground">
            Not included: {formatCents(r.personalCents)} of personal spending ({r.personal.length} item{r.personal.length === 1 ? "" : "s"}).{" "}
            <Link href={`${base}&category=${personalCategoryId}`} className="no-print underline">
              View
            </Link>
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By category</CardTitle>
            </CardHeader>
            <CardContent>
              <Totals
                rows={r.byCategory.map((c) => ({ key: String(c.categoryId), label: c.name, count: c.count, cents: c.cents, href: `${base}&category=${c.categoryId}` }))}
                totalCents={r.totalCents}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By vendor</CardTitle>
            </CardHeader>
            <CardContent>
              <Totals
                rows={r.byVendor.map((v) => ({ key: v.vendor, label: v.vendor, count: v.count, cents: v.cents, href: `${base}&vendor=${encodeURIComponent(v.vendor)}` }))}
                totalCents={r.totalCents}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {drill ? `Transactions: ${drill.label}` : "All transactions"}
              {drill && (
                <Link href={base} className="no-print text-sm font-normal text-muted-foreground underline">
                  Show all
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txRows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                      <TableCell>
                        <Link href={`/expenses/${e.id}`} className="hover:underline">
                          {e.vendor}
                        </Link>
                      </TableCell>
                      <TableCell>{e.categoryName}</TableCell>
                      <TableCell className="text-muted-foreground">{e.description}</TableCell>
                      <TableCell className="tabular text-right">{formatCents(e.amountCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4}>Total</TableCell>
                    <TableCell className="tabular text-right">{formatCents(txTotal)}</TableCell>
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

function Totals({
  rows,
  totalCents,
}: {
  rows: { key: string; label: string; count: number; cents: number; href: string }[];
  totalCents: number;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <Table>
      <TableBody>
        {rows.map((x) => (
          <TableRow key={x.key}>
            <TableCell>
              <Link href={x.href} className="hover:underline">
                {x.label}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">×{x.count}</span>
            </TableCell>
            <TableCell className="tabular w-20 text-right text-xs text-muted-foreground">
              {totalCents ? `${Math.round((x.cents / totalCents) * 100)}%` : ""}
            </TableCell>
            <TableCell className="tabular text-right">{formatCents(x.cents)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="tabular text-right">{formatCents(totalCents)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
