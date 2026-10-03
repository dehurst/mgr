import Link from "next/link";
import { ReportHeader } from "@/components/report-header";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/form-controls";
import { Card, CardContent } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { taxReport } from "@/lib/reports";
import { MEALS_LINE } from "@/lib/reports/tax";
import { getSettings } from "@/lib/settings";

export default async function TaxSummaryPage({ searchParams }: PageProps<"/reports/tax">) {
  const sp = await searchParams;
  const thisYear = Number(today().slice(0, 4));
  // Before April, you're most likely preparing last year's return.
  const defaultYear = Number(today().slice(5, 7)) <= 4 ? thisYear - 1 : thisYear;
  const year = Number(sp.year) >= 2000 && Number(sp.year) <= thisYear ? Number(sp.year) : defaultYear;
  const r = taxReport(getDb(), year);
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);

  return (
    <>
      <ReportHeader
        title={`Schedule C summary · ${year}`}
        period={`Tax year ${year} (Jan 1 – Dec 31) · cash basis`}
        businessName={getSettings().businessName}
        csvHref={`/reports/csv?report=tax&year=${year}`}
      />
      <div className="grid gap-6">
        <form method="get" className="no-print flex items-end gap-3">
          <div className="grid gap-1">
            <Label htmlFor="year">Tax year</Label>
            <Select id="year" name="year" defaultValue={String(year)} className="w-32">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            Show
          </Button>
        </form>

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Line</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="font-semibold">
                  <TableCell>1</TableCell>
                  <TableCell>Gross receipts (all money received)</TableCell>
                  <TableCell className="tabular text-right">{formatCents(r.grossReceiptsCents)}</TableCell>
                </TableRow>
                {r.lines.length === 0 && (
                  <TableRow>
                    <TableCell />
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No expenses recorded for {year}.
                    </TableCell>
                  </TableRow>
                )}
                {r.lines.map((l) => (
                  <LineRows key={l.line} line={l} year={year} />
                ))}
                <TableRow className="font-semibold">
                  <TableCell>28</TableCell>
                  <TableCell>Total expenses</TableCell>
                  <TableCell className="tabular text-right">{formatCents(r.totalExpensesCents)}</TableCell>
                </TableRow>
                <TableRow className="font-semibold">
                  <TableCell />
                  <TableCell>Net (gross receipts minus expenses, before adjustments)</TableCell>
                  <TableCell className="tabular text-right">{formatCents(r.netCents)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Amounts are grouped by the Schedule C line set on each expense category. Meals (line 24b) are limited to the 50% that&apos;s
          deductible; everything else is as recorded. Your CPA decides final treatment, including depreciation (line 13), home office
          (line 30), and self-employment tax. Change a category&apos;s line in Settings → Expense categories.
        </p>
      </div>
    </>
  );
}

function LineRows({ line: l, year }: { line: ReturnType<typeof taxReport>["lines"][number]; year: number }) {
  return (
    <>
      <TableRow>
        <TableCell>{l.line}</TableCell>
        <TableCell>{l.label}</TableCell>
        <TableCell className="tabular text-right">{formatCents(l.cents)}</TableCell>
      </TableRow>
      {/* Always name the categories behind a line, linked to their expenses for the year. */}
      {l.categories.map((c) => (
        <TableRow key={c.categoryId} className="text-muted-foreground">
          <TableCell />
          <TableCell className="pl-6 text-sm">
            <Link href={`/expenses?from=${year}-01-01&to=${year}-12-31&category=${c.categoryId}`} className="hover:underline">
              {c.name}
            </Link>
            {l.line === "27a" && <span className="ml-2 text-xs">(Part V)</span>}
            {l.line === MEALS_LINE && <span className="ml-2 text-xs">spent; 50% is deductible</span>}
          </TableCell>
          <TableCell className="tabular text-right text-sm">{formatCents(c.cents)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}
