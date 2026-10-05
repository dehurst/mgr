import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { Form1099Badge } from "@/components/form-1099-badge";
import { buttonVariants } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { EXPENSE_METHOD_LABELS, listExpenses } from "@/lib/expenses";
import { formatCents } from "@/lib/money";
import { getPayee, TAX_CLASSIFICATION_LABELS } from "@/lib/payees";
import { splitExpense } from "@/lib/reports/data";
import { countsToward1099, form1099Rows, maskedTin, threshold1099 } from "@/lib/reports/form-1099";
import { removePayee, setPayeeArchived } from "../actions";

export default async function PayeePage({ params }: PageProps<"/payees/[id]">) {
  const id = Number((await params).id);
  const db = getDb();
  const payee = getPayee(db, id);
  if (!payee) notFound();
  const { rows } = listExpenses(db, { range: { from: "0000-01-01", to: "9999-12-31" }, payeeId: id });
  const paymentRows = rows.map((r) => ({ ...r, payeeId: id, date: r.paidOn }));
  // One 1099 line per calendar year with payments, newest first.
  const years = [...new Set(rows.map((r) => Number(r.paidOn.slice(0, 4))))].sort((a, b) => b - a);
  const byYear = years.map((year) => ({
    year,
    row: form1099Rows([payee], paymentRows.filter((r) => r.paidOn.startsWith(`${year}-`)), year)[0],
  }));

  return (
    <>
      <PageHeader
        title={payee.name}
        description={
          <>
            {payee.businessName}
            {payee.archivedAt && <Badge variant="outline" className="ml-2">Archived</Badge>}
          </>
        }
        actions={
          <>
            {!payee.archivedAt && (
              <Link href={`/expenses/new?payee=${id}`} className={buttonVariants()}>
                Record a payment
              </Link>
            )}
            <Link href={`/payees/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              Edit
            </Link>
            <ActionButton action={setPayeeArchived.bind(null, id, !payee.archivedAt)}>{payee.archivedAt ? "Restore" : "Archive"}</ActionButton>
            {rows.length === 0 && (
              <ActionButton variant="ghost" confirm={`Delete ${payee.name}? This can't be undone.`} action={removePayee.bind(null, id)}>
                Delete
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>1099-NEC by year</CardTitle>
            </CardHeader>
            <CardContent>
              {byYear.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Counts toward 1099</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byYear.map(({ year, row }) => (
                      <TableRow key={year}>
                        <TableCell>{year}</TableCell>
                        <TableCell className="tabular text-right">
                          {formatCents(row.reportableCents)}
                          <div className="text-xs text-muted-foreground">threshold {formatCents(threshold1099(year).cents)}</div>
                        </TableCell>
                        <TableCell>
                          <Form1099Badge row={row} />
                        </TableCell>
                        <TableCell className="text-right">
                          {row.status === "file" && (
                            <a href={`/payees/${id}/1099?year=${year}`} target="_blank" rel="noreferrer" className="text-sm underline">
                              Recipient copy (PDF)
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None yet. Use <span className="font-medium">Record a payment</span> each time you pay {payee.name}.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="hidden sm:table-cell">Category</TableHead>
                      <TableHead>Paid with</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const { businessCents } = splitExpense(r);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">
                            <Link href={`/expenses/${r.id}`} className="hover:underline">
                              {formatDate(r.paidOn)}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{r.categoryName}</TableCell>
                          <TableCell>
                            {EXPENSE_METHOD_LABELS[r.paymentMethod]}
                            {!countsToward1099(r.paymentMethod) && <div className="text-xs text-muted-foreground">Not on the 1099 (reported by the card / app)</div>}
                          </TableCell>
                          <TableCell className="tabular text-right">
                            {formatCents(r.amountCents)}
                            {businessCents !== r.amountCents && (
                              <div className="text-xs text-muted-foreground">{formatCents(businessCents)} business</div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="content-start">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Detail label="W-9 received" value={payee.w9ReceivedOn ? formatDate(payee.w9ReceivedOn) : "Not on file"} />
            <Detail label="Tax classification" value={payee.taxClassification ? TAX_CLASSIFICATION_LABELS[payee.taxClassification] : ""} />
            <Detail label="Tax ID" value={payee.tinLast4 ? `${payee.tinType?.toUpperCase()} ${maskedTin(payee)}` : ""} />
            {payee.isAttorney && <Detail label="Legal services" value="Yes (always gets a 1099)" />}
            <Detail label="Email" value={payee.email} />
            <Detail label="Address" value={payee.address} />
            <Detail label="Notes" value={payee.notes} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="whitespace-pre-line">{value || "—"}</div>
    </div>
  );
}
