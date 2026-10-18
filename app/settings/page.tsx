import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { formatDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { listUploads, usesBlobStorage } from "@/lib/uploads";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const settings = await getSettings(); // first: it checks sign-in
  const lastBackup =
    (await listUploads())
      .filter((p) => p.startsWith("backups/ledger-"))
      .sort()
      .at(-1)
      ?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
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
            <span className="font-medium text-foreground">Backup</span> is the complete books as one file that can restore
            the app. <span className="font-medium text-foreground">Export</span> is the same data as spreadsheets, for your CPA.
            Receipts stay in the app&apos;s file storage and aren&apos;t in either.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <a href="/backup" className={buttonVariants({ variant: "outline" })}>
              Download backup
            </a>
            <a href="/export" className={buttonVariants({ variant: "outline" })}>
              Export all data (CSV)
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            {lastBackup
              ? `Automatic backups run daily; the latest is from ${formatDate(lastBackup)} (the newest 30 are kept).`
              : usesBlobStorage()
                ? "Automatic daily backups haven't run yet."
                : "Automatic daily backups run when the app is hosted online. Here, download a backup now and then."}
          </p>
        </CardContent>
      </Card>
    </>
  );
}
