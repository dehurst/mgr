import Link from "next/link";
import { Form1099Badge } from "@/components/form-1099-badge";
import { ReportHeader } from "@/components/report-header";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/form-controls";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { today } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { form1099Report } from "@/lib/reports";
import { getSettings } from "@/lib/settings";

export default async function Form1099Page({ searchParams }: PageProps<"/reports/1099">) {
  const sp = await searchParams;
  const thisYear = Number(today().slice(0, 4));
  // 1099s for a year are due Jan 31 of the next, so early in the year you're working on last year's.
  const defaultYear = Number(today().slice(5, 7)) <= 3 ? thisYear - 1 : thisYear;
  const year = Number(sp.year) >= 2000 && Number(sp.year) <= thisYear ? Number(sp.year) : defaultYear;
  const r = form1099Report(getDb(), year);
  const settings = getSettings();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);
  const toFile = r.rows.filter((x) => x.status === "file");

  return (
    <>
      <ReportHeader
        title={`1099-NEC summary · ${year}`}
        period={`Payments made Jan 1 – Dec 31, ${year} · forms due Jan 31, ${year + 1}`}
        businessName={settings.businessName}
        csvHref={`/reports/csv?report=1099&year=${year}`}
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

        {toFile.length > 0 && !settings.taxId && (
          <Alert variant="destructive" className="no-print">
            Add your EIN in <Link href="/settings" className="underline">Settings</Link>: it&apos;s printed on every 1099 you issue.
          </Alert>
        )}

        <Card>
          <CardContent>
            {r.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payees yet. Add the people you pay for work under <Link href="/payees" className="underline">Payees</Link>.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payee</TableHead>
                    <TableHead className="text-right">Box 1 amount</TableHead>
                    <TableHead className="text-right">Card / app (not on 1099)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="no-print" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.rows.map((x) => (
                    <TableRow key={x.payee.id}>
                      <TableCell>
                        <Link href={`/payees/${x.payee.id}`} className="font-medium hover:underline">
                          {x.payee.name}
                        </Link>
                        {x.payee.businessName && <div className="text-xs text-muted-foreground">{x.payee.businessName}</div>}
                      </TableCell>
                      <TableCell className="tabular text-right">{formatCents(x.reportableCents)}</TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">{x.networkCents ? formatCents(x.networkCents) : "—"}</TableCell>
                      <TableCell>
                        <Form1099Badge row={x} />
                      </TableCell>
                      <TableCell className="no-print text-right">
                        {x.status === "file" && (
                          <a href={`/payees/${x.payee.id}/1099?year=${year}`} target="_blank" rel="noreferrer" className="text-sm whitespace-nowrap underline">
                            Recipient copy (PDF)
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>
                      {toFile.length} form{toFile.length === 1 ? "" : "s"} to file
                    </TableCell>
                    <TableCell className="tabular text-right">{formatCents(toFile.reduce((s, x) => s + x.reportableCents, 0))}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              A 1099-NEC is needed when you paid someone {formatCents(r.threshold.cents)} or more for work in {year}
              {r.threshold.isEstimate ? " (adjusted for inflation from 2027: check the IRS's figure and update the app)" : ""}. Box 1 counts
              checks, cash, bank transfers, and Venmo/PayPal friends &amp; family. Card payments and Venmo/PayPal goods &amp; services are
              reported by the card company or app instead. Corporations are skipped unless they provide legal services.
            </p>
          </CardContent>
        </Card>

        <Card className="no-print">
          <CardHeader>
            <CardTitle>How to send them (by Jan 31, {year + 1})</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid list-decimal gap-2 pl-5 text-sm">
              <li>Fix anything marked missing. You need each person&apos;s W-9 (name, address, and full tax ID).</li>
              <li>
                <span className="font-medium">Give each person their copy:</span> open &ldquo;Recipient copy (PDF)&rdquo; and email or mail it.
                It shows only the last 4 digits of their tax ID, which the IRS allows on the recipient&apos;s copy.
              </li>
              <li>
                <span className="font-medium">File with the IRS:</span> use the IRS&apos;s free filing site, IRIS (search &ldquo;IRS IRIS
                taxpayer portal&rdquo;). Type in each form there, using the full tax ID from the W-9. Don&apos;t mail a printout of the
                PDF: the IRS copy must be filed online or on the official red form.
              </li>
              <li>Ask your CPA whether your state also needs a copy.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
