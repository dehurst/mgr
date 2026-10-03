import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  const settings = getSettings();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your business details appear on invoices and emails."
        actions={
          <Link href="/settings/categories" className={buttonVariants({ variant: "outline" })}>
            Expense categories
          </Link>
        }
      />
      <SettingsForm settings={settings} smtpConfigured={Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)} />
    </>
  );
}
