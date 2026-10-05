"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, PageHeader } from "@/components/ui/misc";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <PageHeader title="Something went wrong" />
      <Card>
        <CardContent className="grid gap-4 text-sm">
          <p>The page hit an error. Nothing was saved halfway: each change either saves completely or not at all.</p>
          <p className="text-muted-foreground">
            Details: {error.message || "unknown error"}
            {error.digest ? ` (ref ${error.digest})` : ""}. The full error is in the app log (<code>npm run service:logs</code>).
          </p>
          <div className="flex gap-2">
            <Button onClick={() => retry()}>Try again</Button>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
