import { RangeFilter } from "@/components/range-filter";
import { ReportHeader } from "@/components/report-header";
import { Card, CardContent } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate, today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { rangeQuery, resolveRange } from "@/lib/range";
import { pnlReport } from "@/lib/reports";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export default async function PnlPage({ searchParams }: PageProps<"/reports/pnl">) {
  const sp = await searchParams;
  const range = resolveRange(sp, today(), "ytd");
  const compare = sp.compare === "1";
  const r = pnlReport(getDb(), range, compare);
  const p = r.prior;

  return (
    <>
      <ReportHeader
        title="Profit & Loss"
        period={`${formatDate(range.from)} – ${formatDate(range.to)} · cash basis${r.priorRange ? ` · compared with ${formatDate(r.priorRange.from)} – ${formatDate(r.priorRange.to)}` : ""}`}
        businessName={getSettings().businessName}
        csvHref={`/reports/csv?report=pnl&${rangeQuery(range)}${compare ? "&compare=1" : ""}`}
      />
      <Card>
        <CardContent className="grid gap-4">
          <RangeFilter range={range}>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" name="compare" value="1" defaultChecked={compare} /> Compare with prior period
            </label>
          </RangeFilter>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead className="text-right">{p ? "This period" : "Amount"}</TableHead>
                {p && (
                  <>
                    <TableHead className="text-right">Prior period</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              <Section cmp={!!p} label="Income" />
              <Row cmp={!!p} indent label="Invoice payments" cur={r.current.invoicePaymentsCents} pri={p?.invoicePaymentsCents} />
              <Row cmp={!!p} indent label="Other income" cur={r.current.otherIncomeCents} pri={p?.otherIncomeCents} />
              <Row cmp={!!p} strong label="Total income" cur={r.current.incomeCents} pri={p?.incomeCents} />
              <Section cmp={!!p} label="Expenses" />
              {r.categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={p ? 4 : 2} className="pl-6 text-muted-foreground">
                    No expenses in this period.
                  </TableCell>
                </TableRow>
              )}
              {r.categories.map((c) => (
                <Row cmp={!!p} key={c.id} indent label={c.name} cur={c.current} pri={c.prior} />
              ))}
              <Row cmp={!!p} strong label="Total expenses" cur={r.current.expensesCents} pri={p?.expensesCents} />
              <Section cmp={!!p} label="" />
              <Row cmp={!!p} strong label="Net profit" cur={r.current.netCents} pri={p?.netCents} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, cur, pri, strong, indent, cmp }: { label: string; cur: number; pri?: number; strong?: boolean; indent?: boolean; cmp: boolean }) {
  return (
    <TableRow className={cn(strong && "font-semibold")}>
      <TableCell className={cn(indent && "pl-6")}>{label}</TableCell>
      <TableCell className="tabular text-right">{formatCents(cur)}</TableCell>
      {cmp && (
        <>
          <TableCell className="tabular text-right text-muted-foreground">{formatCents(pri ?? 0)}</TableCell>
          <TableCell className="tabular text-right">{formatCents(cur - (pri ?? 0))}</TableCell>
        </>
      )}
    </TableRow>
  );
}

function Section({ label, cmp }: { label: string; cmp: boolean }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={cmp ? 4 : 2} className="pt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}
