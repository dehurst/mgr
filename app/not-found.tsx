import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, PageHeader } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <Card>
        <CardContent className="grid gap-4 text-sm">
          <p>That page or record doesn&apos;t exist. It may have been deleted.</p>
          <div>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Back to the dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
