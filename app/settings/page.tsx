import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  const settings = getSettings();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your business details appear on every invoice."
        actions={
          <Link href="/settings/categories" className={buttonVariants({ variant: "outline" })}>
            Expense categories
          </Link>
        }
      />
      <SettingsForm settings={settings} />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Everything in the app (invoices, payments, expenses, income, clients, payees) as spreadsheet files in one zip. Good for
            your CPA, or if you ever move to another app. Receipts aren&apos;t included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/export" className={buttonVariants({ variant: "outline" })}>
            Export all data (CSV)
          </a>
        </CardContent>
      </Card>
    </>
  );
}
