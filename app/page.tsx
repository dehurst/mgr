import Link from "next/link";
import { Stat } from "@/components/stat";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { getDb } from "@/db";
import { daysBetween, formatDate, today } from "@/lib/dates";
import { dashboardData } from "@/lib/dashboard";
import { formatCents } from "@/lib/money";
import { getSettings } from "@/lib/settings";

const KIND_LABEL = { payment: "Payment", income: "Income", expense: "Expense", sent: "Invoice", created: "Invoice" } as const;

export default function DashboardPage() {
  const s = getSettings();
  const now = today();
  const d = dashboardData(getDb(), now);
  const setupMissing = [
    !s.businessName && "business name",
    !s.address && "address",
    !s.paymentInstructions && "payment instructions",
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${s.businessName || "Your business"} · ${formatDate(now)}`}
        actions={
          <>
            <Link href="/invoices/new" className={buttonVariants()}>
              New invoice
            </Link>
            <Link href="/expenses/new" className={buttonVariants({ variant: "outline" })}>
              New expense
            </Link>
          </>
        }
      />

      {setupMissing.length > 0 && (
        <Card className="mb-6">
          <CardContent className="text-sm">
            Finish setup: add your {setupMissing.join(", ")} in{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            . They print on every invoice.
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue this year" value={formatCents(d.ytdPnl.incomeCents)} sub={`${formatCents(d.monthPnl.incomeCents)} this month`} />
        <Stat label="Expenses this year" value={formatCents(d.ytdPnl.expensesCents)} sub={`${formatCents(d.monthPnl.expensesCents)} this month`} />
        <Stat
          label="Net profit this year"
          value={formatCents(d.ytdPnl.netCents)}
          tone={d.ytdPnl.netCents < 0 ? "danger" : undefined}
          sub={<Link href="/reports/pnl?range=ytd" className="underline">Profit &amp; Loss</Link>}
        />
        <Stat
          label="Owed to you"
          value={formatCents(d.aging.totalCents)}
          tone={d.aging.overdueCents > 0 ? "danger" : undefined}
          sub={
            d.aging.overdueCents > 0 ? (
              <span className="font-medium text-destructive">{formatCents(d.aging.overdueCents)} overdue</span>
            ) : (
              "Nothing overdue"
            )
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue invoices</CardTitle>
            {d.drafts > 0 && (
              <CardDescription>
                {d.drafts} draft{d.drafts === 1 ? "" : "s"} not marked sent yet.{" "}
                <Link href="/invoices?status=draft" className="underline">
                  Review
                </Link>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {d.overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">None. Nice.</p>
            ) : (
              <Table>
                <TableBody>
                  {d.overdue.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link href={`/invoices/${i.id}`} className="font-medium hover:underline">
                          {i.number}
                        </Link>
                        <div className="text-xs text-muted-foreground">{i.clientName}</div>
                      </TableCell>
                      <TableCell className="text-sm text-destructive">{daysBetween(i.dueOn, now)} days late</TableCell>
                      <TableCell className="tabular text-right">{formatCents(i.balanceCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {d.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet. Create an invoice or add an expense to get started.</p>
            ) : (
              <Table>
                <TableBody>
                  {d.activity.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="w-24 whitespace-nowrap text-xs text-muted-foreground">{formatDate(a.date)}</TableCell>
                      <TableCell>
                        <Link href={a.href} className="hover:underline">
                          {a.text}
                        </Link>
                        <div className="text-xs text-muted-foreground">{KIND_LABEL[a.kind]}</div>
                      </TableCell>
                      <TableCell className={`tabular text-right ${a.kind === "expense" ? "text-muted-foreground" : ""}`}>
                        {a.cents === null ? "" : `${a.kind === "expense" ? "−" : "+"}${formatCents(a.cents)}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
