import Link from "next/link";
import { RangeFilter } from "@/components/range-filter";
import { ReportHeader } from "@/components/report-header";
import { TotalsTable } from "@/components/totals-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate, today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { rangeQuery, resolveRange } from "@/lib/range";
import { personalReport } from "@/lib/reports";
import { getSettings } from "@/lib/settings";

// Same color as personal spending in the Expenses chart.
const PERSONAL = "#eb6834";
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export default async function PersonalSpendingPage({ searchParams }: PageProps<"/reports/personal">) {
  const sp = await searchParams;
  const range = resolveRange(sp, today(), "ytd");
  const r = await personalReport(await getDb(), range);
  const base = `/reports/personal?${rangeQuery(range)}`;
  const vendor = typeof sp.vendor === "string" ? sp.vendor : "";
  const categoryId = Number(sp.category) || null;
  const drill = vendor
    ? { label: vendor, items: r.items.filter((e) => e.vendor.trim().toLowerCase() === vendor.trim().toLowerCase()) }
    : categoryId
      ? { label: r.bySource.find((x) => x.categoryId === categoryId)?.name ?? "Category", items: r.items.filter((e) => e.categoryId === categoryId) }
      : null;
  const items = drill ? drill.items : r.items;
  const allSpent = r.businessCents + r.totalCents;
  const maxMonth = Math.max(0, ...r.byMonth.map((m) => m.cents));

  return (
    <>
      <ReportHeader
        title="Personal spending"
        period={`${formatDate(range.from)} – ${formatDate(range.to)} · ${formatCents(r.totalCents)}`}
        businessName={(await getSettings()).businessName}
        csvHref={`/reports/csv?report=personal&${rangeQuery(range)}`}
      />
      <div className="grid gap-6">
        <Card className="no-print">
          <CardContent>
            <RangeFilter range={range} />
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          Purchases in your personal category, plus the personal share of mixed-use expenses (like the part of your phone bill
          that isn&apos;t business). None of this counts toward profit or taxes.
          {allSpent > 0 && r.totalCents > 0 && (
            <>
              {" "}
              It&apos;s <span className="font-medium text-foreground">{Math.round((r.totalCents / allSpent) * 100)}%</span> of the{" "}
              {formatCents(allSpent)} spent in this period.
            </>
          )}
        </p>

        {r.items.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">No personal spending in this period.</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>By vendor</CardTitle>
                  <CardDescription>Largest first.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TotalsTable
                    rows={r.byVendor.map((v) => ({ key: v.vendor, label: v.vendor, count: v.count, cents: v.cents, href: `${base}&vendor=${encodeURIComponent(v.vendor)}` }))}
                    totalCents={r.totalCents}
                  />
                </CardContent>
              </Card>
              <div className="grid content-start gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>By source</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TotalsTable
                      rows={r.bySource.map((x) => ({
                        key: String(x.categoryId),
                        label: x.fullyPersonal ? x.name : `${x.name} (personal share)`,
                        count: x.count,
                        cents: x.cents,
                        href: `${base}&category=${x.categoryId}`,
                      }))}
                      totalCents={r.totalCents}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>By month</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {r.byMonth.map((m) => (
                          <TableRow key={m.month}>
                            <TableCell className="w-24 whitespace-nowrap">{MONTH.format(new Date(`${m.month}-01T00:00:00Z`))}</TableCell>
                            <TableCell className="w-full">
                              <div
                                className="h-2.5 rounded-r-[4px]"
                                style={{ width: `${maxMonth ? Math.max(0, (m.cents / maxMonth) * 100) : 0}%`, background: PERSONAL }}
                                aria-hidden
                              />
                            </TableCell>
                            <TableCell className="tabular text-right">{formatCents(m.cents)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {drill ? `Transactions: ${drill.label}` : "All personal spending"}
                  {drill && (
                    <Link href={base} className="no-print text-sm font-normal text-muted-foreground underline">
                      Show all
                    </Link>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="hidden sm:table-cell">Category</TableHead>
                      <TableHead className="text-right">Personal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                        <TableCell>
                          <Link href={`/expenses/${e.id}`} className="hover:underline">
                            {e.vendor}
                          </Link>
                          {e.description && <div className="max-w-80 truncate text-xs text-muted-foreground">{e.description}</div>}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{e.categoryName}</TableCell>
                        <TableCell className="tabular text-right">
                          {formatCents(e.personalCents)}
                          {e.personalCents !== e.amountCents && (
                            <div className="text-xs text-muted-foreground">
                              {100 - e.businessPct}% of {formatCents(e.amountCents)}
                            </div>
                          )}
                          {e.amountCents < 0 && <div className="text-xs text-muted-foreground">refund</div>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="hidden sm:table-cell" />
                      <TableCell className="tabular text-right">{formatCents(items.reduce((s, e) => s + e.personalCents, 0))}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
