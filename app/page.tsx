import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { getSettings } from "@/lib/settings";

export default function DashboardPage() {
  const s = getSettings();
  const setup = [
    { done: Boolean(s.businessName), label: "Business name" },
    { done: Boolean(s.email), label: "Business email" },
    { done: Boolean(s.address), label: "Address" },
    { done: Boolean(s.paymentInstructions), label: "Payment instructions (Venmo handle / check payee)" },
  ];
  const remaining = setup.filter((x) => !x.done);
  return (
    <>
      <PageHeader title="Dashboard" description="Revenue, expenses, and receivables arrive in Phase 5." />
      {remaining.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Finish setup</CardTitle>
            <CardDescription>These appear on every invoice.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ul className="list-inside list-disc text-sm">
              {remaining.map((x) => (
                <li key={x.label}>{x.label}</li>
              ))}
            </ul>
            <div>
              <Link href="/settings" className={buttonVariants()}>
                Open settings
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
