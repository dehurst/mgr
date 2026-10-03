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
        description="Your business details appear on every invoice."
        actions={
          <Link href="/settings/categories" className={buttonVariants({ variant: "outline" })}>
            Expense categories
          </Link>
        }
      />
      <SettingsForm settings={settings} />
    </>
  );
}
