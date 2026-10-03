import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";

const REPORTS = [
  { href: "/reports/pnl", title: "Profit & Loss", text: "Money in minus money out for any period, with an optional comparison to the prior period." },
  { href: "/reports/expenses", title: "Expense report", text: "Spending by category and by vendor. Click any row to see the transactions." },
  { href: "/reports/aging", title: "Accounts receivable aging", text: "Who owes you, and how late: current, 1–30, 31–60, 61–90, 90+ days." },
  { href: "/reports/income-by-client", title: "Income by client", text: "What each client paid you in a period." },
  { href: "/reports/tax", title: "Tax summary (Schedule C)", text: "Expenses rolled up by Schedule C line for a tax year. Hand this to your CPA." },
];

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="All reports are cash basis: income counts when received, expenses when paid." />
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{r.title}</CardTitle>
                <CardDescription>{r.text}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
