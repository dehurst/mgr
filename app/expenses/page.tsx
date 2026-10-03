import Link from "next/link";
import { RangeFilter } from "@/components/range-filter";
import { buttonVariants } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/form-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate, today } from "@/lib/dates";
import { categoryOptions, EXPENSE_METHOD_LABELS, listExpenses } from "@/lib/expenses";
import { formatCents } from "@/lib/money";
import { resolveRange } from "@/lib/range";
import { PERSONAL_LINE } from "@/lib/schedule-c";
import { expenseCategories } from "@/db/schema";
import { asc } from "drizzle-orm";
import { MonthChart } from "@/components/month-chart";
import { loadExpenses } from "@/lib/reports/data";
import { axisTicks, expensesByMonth } from "@/lib/reports/expenses";

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const sp = await searchParams;
  const range = resolveRange(sp, today());
  const categoryId = Number(sp.category) || undefined;
  const db = getDb();
  // Filter dropdown includes archived categories, since old expenses may use them.
  const categories = db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).orderBy(asc(expenseCategories.name)).all();
  const { rows, totalCents, personalCents } = listExpenses(db, { range, categoryId });
  const hasActiveCategories = categoryOptions(db).length > 0;
  // The chart always shows the whole calendar year of the selected period's end date.
  const chartYear = Number(range.to.slice(0, 4));
  const months = expensesByMonth(loadExpenses(db, { from: `${chartYear}-01-01`, to: `${chartYear}-12-31` }), chartYear);
  const yearBusiness = months.reduce((s, m) => s + m.businessCents, 0);
  const yearPersonal = months.reduce((s, m) => s + m.personalCents, 0);

  return (
    <>
      <PageHeader
        title="Expenses"
        description={`${formatDate(range.from)} – ${formatDate(range.to)}`}
        actions={
          hasActiveCategories && (
            <Link href="/expenses/new" className={buttonVariants()}>
              New expense
            </Link>
          )
        }
      />
      <Card className="mb-6">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div className="grid gap-1">
            <CardTitle>Business expenses by month, {chartYear}</CardTitle>
            {yearPersonal > 0 && <CardDescription>Personal spending ({formatCents(yearPersonal)}) is not included.</CardDescription>}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total for {chartYear}</div>
            <div className="text-xl font-semibold">{formatCents(yearBusiness)}</div>
          </div>
        </CardHeader>
        <CardContent>
          <MonthChart year={chartYear} months={months} ticks={axisTicks(Math.max(...months.map((m) => m.businessCents)))} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-4">
          <RangeFilter range={range}>
            <div className="grid gap-1">
              <Label htmlFor="f-category">Category</Label>
              <Select id="f-category" name="category" defaultValue={categoryId ? String(categoryId) : ""} className="w-52">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </RangeFilter>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No expenses in this period.{" "}
              <Link href="/expenses/new" className="underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Paid with</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.paidOn)}</TableCell>
                    <TableCell>
                      <Link href={`/expenses/${r.id}`} className="font-medium hover:underline">
                        {r.vendor}
                      </Link>
                      {r.description && <div className="max-w-80 truncate text-xs text-muted-foreground">{r.description}</div>}
                    </TableCell>
                    <TableCell className={r.scheduleCLine === PERSONAL_LINE ? "text-muted-foreground italic" : undefined}>{r.categoryName}</TableCell>
                    <TableCell className="text-muted-foreground">{EXPENSE_METHOD_LABELS[r.paymentMethod]}</TableCell>
                    <TableCell>
                      {r.receiptPath ? (
                        <a href={`/files/${r.receiptPath}`} target="_blank" rel="noreferrer" className="text-sm underline">
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatCents(r.amountCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>{personalCents ? "Business expenses" : `Total (${rows.length} expense${rows.length === 1 ? "" : "s"})`}</TableCell>
                  <TableCell className="tabular text-right">{formatCents(totalCents)}</TableCell>
                </TableRow>
                {personalCents > 0 && (
                  <TableRow className="text-muted-foreground">
                    <TableCell colSpan={5}>Personal (not business, left out of reports)</TableCell>
                    <TableCell className="tabular text-right">{formatCents(personalCents)}</TableCell>
                  </TableRow>
                )}
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
